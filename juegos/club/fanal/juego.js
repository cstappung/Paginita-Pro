/* FANAL — la pantalla: el bucle, las entidades, los jefes, la luz y el relato.

   Qué hace, en general:
   - Corre un bucle a 60 cuadros por segundo que actualiza el juego y lo
     dibuja en un lienzo lógico de 240×320 (pixel art), y después lo copia
     al lienzo visible tres veces más grande, sin suavizar.
   - Encima del dibujo pone la LUZ por capas: una máscara de oscuridad con
     agujeros donde hay luz (la llama, los tiros, las escamas, las
     explosiones), posterizada con un tramado de Bayer para que también la
     luz sea pixel art; una capa aditiva de brillos; y un bloom suave que
     sale de esa capa. La oscuridad depende del acto: en el enjambre casi no
     hay, en lo oscuro solo se ve lo que toca tu llama.
   - La música no es un fondo: el motor (musica.js) cuenta los pulsos y el
     juego los usa para la marcha de la formación (el «latido»), para que la
     llama lata y para juzgar si un disparo salió afinado.
   - El relato se cuenta entre jornadas (la bitácora), en las cartas que
     suelta la Mensajera y en tres secuencias que no se pueden saltar: la
     revelación (al apagar el Faro Ciego), el cruce con el Alba y el final
     de la Hoguera. Después del Alba la travesía no termina: sigue a la
     otra orilla, y después de la Hoguera, sin fin.
   - Entre jornada y jornada abre el TALLER: cada jefe vencido da una
     brasa, y cada brasa sube una mejora del arma o del fanal (motor.js:
     MEJORAS, armas, nave). Cada tres en una rama, el arma o el fanal
     evoluciona y se ve distinto. Cada jornada trae además un augurio: la
     noche aprende algo y se pone un poco más difícil.
   - Lo que dura de una partida a otra (cartas leídas, final visto, punto de
     control, récords) se guarda en el navegador y, dentro de Juegos, en la
     cuenta (Club.guardarPartida). Los puntajes van a la clasificación con
     Club.result.

   Por qué así: todo lo que decide el juego está en motor.js (puro y
   probado en Node); este archivo solo lo hace verse, sonar y sentirse. */
(function () {
  "use strict";
  // El runtime de algunas páginas evalúa los scripts dos veces: con esto, una sola.
  if (window.__fanalCargado) return;
  window.__fanalCargado = true;

  const M = window.FanalMotor, R = window.FanalRelato, S = window.FanalSprites, MU = window.FanalMusica, FP = window.FanalPrueba;
  const Club = window.Club || null;
  const W = M.ANCHO, H = M.ALTO, K = 3;          // lienzo lógico y cuántas veces se agranda
  const $ = id => document.getElementById(id);
  const azar = (a, b) => a + Math.random() * (b - a);
  const entero = (a, b) => Math.floor(azar(a, b + 1));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const suave = t => t * t * (3 - 2 * t);
  const reducido = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ================================================================
     Almacenamiento, opciones y progreso
     ================================================================ */
  const clave = k => (Club ? Club.storageKey(k) : k);                 // cada cuenta guarda lo suyo
  const lee = (k, d) => { try { const v = JSON.parse(localStorage.getItem(clave(k))); return v == null ? d : v; } catch (e) { return d; } };
  const guarda = (k, v) => { try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch (e) { /* sin almacenamiento se juega igual */ } };

  const opciones = Object.assign({ lineas: true, aberracion: !reducido, destellos: reducido, sacudida: reducido ? 0.5 : 1, musica: 0.8, efectos: 0.9, sonido: true }, lee("fanal.opciones", {}));
  const guardaOpciones = () => guarda("fanal.opciones", opciones);

  let prog = M.mezclaProgreso(lee("fanal.progreso", null), null);     // lo leído, los finales vistos, la travesía a medias
  // Lo que jugó como invitado en esta pestaña, si acaba de iniciar sesión
  // (Club.deInvitado): se junta con lo de la cuenta, travesía a medias incluida.
  try {
    const previo = Club && Club.deInvitado ? Club.deInvitado("fanal.progreso") : null;
    if (previo) { prog = M.mezclaProgreso(prog, JSON.parse(previo)); guarda("fanal.progreso", prog); }
  } catch (e) { /* un progreso ilegible no se adopta */ }
  function guardaProgreso(subir) {
    guarda("fanal.progreso", prog);
    if (subir !== false && Club && Club.guardarPartida) Club.guardarPartida(JSON.stringify(prog)); // y a la cuenta
  }
  /* Una travesía guardada por otra versión del juego no se puede retomar:
     su prueba no se rehace con estas reglas. Se descarta (con la hora de
     ahora, para que el borrado gane también en la cuenta). */
  function descartaVieja() {
    const p = prog.punto;
    if (!p || !(p.j > 0) || p.ver === FP.VERSION) return false;
    prog.punto = { j: 0, at: Date.now() };
    return true;
  }
  if (descartaVieja()) guardaProgreso(false);
  /* Lo de la cuenta se junta con lo de aquí: se suman las cartas, el final
     visto no se olvida y el punto de control más nuevo gana. */
  if (Club && Club.pedirPartida) Club.pedirPartida(dato => {
    let nube = null;
    try { nube = dato && typeof dato.d === "string" ? JSON.parse(dato.d) : null; } catch (e) { nube = null; }
    const junto = M.mezclaProgreso(prog, nube), antes = JSON.stringify(prog);
    prog = junto;
    descartaVieja();
    guardaProgreso(JSON.stringify(junto) !== JSON.stringify(M.mezclaProgreso(nube, null)) || antes !== JSON.stringify(junto));
    pintaPortada();
  });

  /* ================================================================
     Lienzos
     ================================================================ */
  const lienzo = $("lienzo"), pv = lienzo.getContext("2d");          // el visible (720×960)
  const escena = S.lienzo(W, H), ex = escena.getContext("2d");       // donde se dibuja el juego
  const luz = S.lienzo(W, H), lx = luz.getContext("2d");             // brillos aditivos
  const sombra = S.lienzo(W, H), sx = sombra.getContext("2d", { willReadFrequently: true }); // la oscuridad
  const bloomA = S.lienzo(W / 2, H / 2), ba = bloomA.getContext("2d");
  const bloomB = S.lienzo(W / 4, H / 4), bb = bloomB.getContext("2d");
  const abR = S.lienzo(W * K, H * K), arx = abR.getContext("2d");    // aberración: canal rojo…
  const abC = S.lienzo(W * K, H * K), acx = abC.getContext("2d");    // …y cian
  const banco = S.crearBanco();
  const musica = MU.crearMotor();
  for (const c of [ex, lx, sx]) c.imageSmoothingEnabled = false;

  /* La matriz de Bayer de 4×4: el tramado que convierte degradados en
     pixel art (cielos, nubes y la oscuridad misma). */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

  /* ================================================================
     El cielo: degradados, nubes, estrellas y lo que flota
     ================================================================ */

  /* Ruido de valor periódico (se repite sin costura en x y en y): las nubes
     y la niebla pueden desplazarse para siempre. */
  function ruido(w, h, celdas, semilla) {
    const r = M.mulberry32(semilla), gx = celdas, gy = Math.max(1, Math.round(celdas * h / w));
    const g = new Float32Array(gx * gy).map(() => r());
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * gy, y0 = Math.floor(fy), ty = suave(fy - y0);
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * gx, x0 = Math.floor(fx), tx = suave(fx - x0);
        const a = g[(y0 % gy) * gx + (x0 % gx)], b = g[(y0 % gy) * gx + ((x0 + 1) % gx)];
        const c = g[((y0 + 1) % gy) * gx + (x0 % gx)], d = g[((y0 + 1) % gy) * gx + ((x0 + 1) % gx)];
        out[y * w + x] = lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
      }
    }
    return out;
  }
  /* Nubes tramadas: dos tonos y una cobertura; lo que pasa del umbral se
     pinta, y el tramado decide los bordes. */
  function texturaNubes(colores, cobertura, alfa, semilla, alto) {
    const w = W, h = alto || H * 2, c = S.lienzo(w, h), x = c.getContext("2d");
    const n1 = ruido(w, h, 4, semilla), n2 = ruido(w, h, 9, semilla + 7), n3 = ruido(w, h, 22, semilla + 13);
    const img = x.createImageData(w, h), d = img.data;
    const c0 = S.rgb(colores[0]), c1 = S.rgb(colores[1]);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const i = y * w + xx, v = n1[i] * 0.55 + n2[i] * 0.3 + n3[i] * 0.15;
      const s = clamp((v - (1 - cobertura)) / 0.25, 0, 1);         // cuánto «nube» es este píxel
      const b = BAYER[(y & 3) * 4 + (xx & 3)];
      if (s > b) {
        const claro = s * 0.7 > b + 0.2;                           // el centro de la nube, más claro
        const col = claro ? c1 : c0, o = i * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = Math.round(255 * alfa * (claro ? 1 : 0.8));
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  /* El degradado del cielo de un acto, tramado en 16 niveles por canal. */
  function texturaCielo(cols) {
    const c = S.lienzo(W, H), x = c.getContext("2d"), img = x.createImageData(W, H), d = img.data;
    const c0 = S.rgb(cols[0]), c1 = S.rgb(cols[1]), c2 = S.rgb(cols[2]);
    for (let y = 0; y < H; y++) {
      const t = y / (H - 1);
      const col = t < 0.5 ? c0.map((v, i) => lerp(v, c1[i], t * 2)) : c1.map((v, i) => lerp(v, c2[i], (t - 0.5) * 2));
      for (let xx = 0; xx < W; xx++) {
        const b = BAYER[(y & 3) * 4 + (xx & 3)] - 0.5, o = (y * W + xx) * 4;
        for (let k = 0; k < 3; k++) d[o + k] = clamp(Math.round(col[k] / 17 + b) * 17, 0, 255);
        d[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  /* Lo que cada acto pone en su cielo, pintado una vez y guardado. */
  const fondos = {};
  function fondoDe(acto) {
    if (fondos[acto]) return fondos[acto];
    const p = S.PALETAS[acto], f = { cielo: texturaCielo(p.cielo) };
    if (acto === 1) f.nubes = texturaNubes(p.nube, 0.42, 0.55, 11);
    if (acto === 2) { f.nubes = texturaNubes(p.nube, 0.62, 0.32, 23); f.niebla = texturaNubes([p.nube[0], p.nube[1]], 0.5, 0.42, 29); }
    if (acto === 3) f.nubes = texturaNubes(p.nube, 0.18, 0.6, 37);
    if (acto === 4) f.nubes = texturaNubes(p.nube, 0.38, 0.5, 41);
    if (acto === 5) f.nubes = texturaNubes(p.nube, 0.26, 0.5, 53);
    if (acto === 6) f.nubes = texturaNubes(p.nube, 0.5, 0.45, 61);
    if (acto === 7) f.nubes = texturaNubes(p.nube, 0.55, 0.4, 67);
    if (acto === 8) f.nubes = texturaNubes(p.nube, 0.4, 0.55, 71);
    if (acto === 9) f.nubes = texturaNubes(p.nube, 0.35, 0.5, 79);
    if (acto === 10) f.nubes = texturaNubes(p.nube, 0.2, 0.6, 83);
    if (acto === 11) f.nubes = texturaNubes(p.nube, 0.5, 0.4, 89);
    return (fondos[acto] = f);
  }

  /* El estado del cielo: qué acto se ve, hacia cuál se va (en el tránsito
     se funden), las estrellas y lo que flota cerca. */
  const cielo = {
    desde: 1, hacia: 1, mezcla: 1,     // fundido entre actos
    vel: 4, velObj: 4,                  // px/s del desplazamiento (en el tránsito se acelera: se rema)
    desp: 0,                            // cuánto se desplazó (para las capas)
    estrellas: [], motas: [], siluetas: [], fantasmas: 0, tSilueta: 8, lleno: 0
  };
  /* Crea `n` estrellas. Cada una es una luz del contador: cuando se apaga
     una polilla, se apaga una de estas. */
  function creaEstrellas(n, semilla) {
    const r = M.mulberry32(semilla), out = [];
    for (let i = 0; i < n; i++) out.push({ x: r() * W, y: r() * H, z: 0.25 + r() * 0.75, c: Math.floor(r() * 3), tw: r() * 6.28, viva: true, muere: 0, nace: 0 });
    return out;
  }
  function creaMotas() {
    cielo.motas = Array.from({ length: 34 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: azar(0.6, 1.4), f: Math.random() * 6.28 }));
  }
  /* Apaga una estrella (la más cercana a la mitad de arriba, para que se
     vea): es la luz que se fue con la polilla. */
  function apagaEstrella() {
    if (P && P.luces > 0) P.luces--;
    const vivas = cielo.estrellas.filter(e => e.viva && e.muere === 0);
    if (!vivas.length) return;
    const visibles = vivas.filter(e => e.y > 20 && e.y < 230);
    const e = (visibles.length ? visibles : vivas)[Math.floor(Math.random() * (visibles.length || vivas.length))];
    e.muere = 0.8;                                                     // se apaga en 0,8 s, con un último destello
    const hl = $("hudLuces"); hl.classList.remove("apaga"); void hl.offsetWidth; hl.classList.add("apaga");
  }

  /* ================================================================
     Estado de la partida
     ================================================================ */
  let estado = "portada";       // portada · relato · juego · revelacion · final · muriendo · pausa · fin
  let previoPausa = "juego";    // a qué se vuelve al quitar la pausa
  let panel = null;             // el panel abierto encima (bitácora, ayuda, opciones…)
  let panelVuelve = null;       // a qué capa se vuelve al cerrarlo
  let tMusica = 0;              // el reloj de la música (avanza salvo en pausa)
  let P = null;                 // la partida en curso
  let F = null;                 // el fanal
  let form = null, polillas = [], balas = [], escamas = [], poderes = [], particulas = [], flotantes = [], destellos = [];
  let naufragios = [], msj = null, jefe = null, lumbres = [], sombras = [], larvas = [];
  let cenizas = [];             // nubes de polvo de ala que bajan (jornada 10)
  let hilos = [];               // los hilos de seda que cuelgan las polillas (acto VI)
  let anclas = [];              // el ancla del Casco
  let columnas = [];            // las columnas de fuego de la Hoguera
  let luciernagas = [];         // las que te siguen (evolución del fanal) y los fanales liberados
  /* En la portada, unas pocas polillas revolotean alrededor de la llama:
     lo primero que se ve ya es lo que el juego va a contar. */
  const adorno = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * Math.PI * 2, r: 22 + i * 9, w: (i % 2 ? 1 : -1) * (0.5 + i * 0.06), f: i * 1.7, tipo: ["a", "b", "c"][i % 3] }));
  const fx = { trauma: 0, aberr: 0, flash: 0, flashColor: "#fff", eclipse: 1, eclipseObj: 1, lenta: 1, lentaT: 0, metro: 0 };
  let pulsoLuz = 0;             // la llama late con cada pulso (0..1)
  /* Lo que tiene que pasar dentro de un rato (terminar la jornada, mostrar
     el fin…) va en este reloj y no en setTimeout: así se detiene en la
     pausa y se descarta si para entonces ya empezó otra partida. */
  let agenda = [];
  function programa(fn, seg) { agenda.push({ t: seg, fn, P }); }
  function corre(dt) {
    if (!agenda.length) return;
    const listos = [];
    for (const a of agenda) { a.t -= dt; if (a.t <= 0) listos.push(a); }
    agenda = agenda.filter(a => a.t > 0 && a.P === P);
    for (const a of listos) if (a.P === P) a.fn();
  }
  const teclas = { izq: false, der: false, fuego: false };
  let toque = null;             // el dedo que rema (x lógica) o null
  let autoT = 0;                // espera del disparo automático

  /* ================================================================
     La prueba de la partida (prueba.js, docs/antitrampas/fanal.md)
     ================================================================
     Cada jornada se anota mientras se juega: los tiros, lo que toca cada
     bala, los golpes, los poderes y los pulsos de la música. Con eso el
     club rehace los puntos antes de guardar un récord. Una partida en la
     que se usó __fanal (o que siguió de un punto de control sin prueba) se
     juega igual, pero no se manda a la clasificación. */
  let tocada = false;           // ¿se usó __fanal en esta página? Desde entonces nada cuenta
  const cuentaUrl = new URLSearchParams(location.search).get("cuenta") || "local";
  function nuevoId() {
    const a = new Uint32Array(3);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 3; i++) a[i] = Math.floor(Math.random() * 4294967296); }
    return Array.from(a, x => x.toString(36).padStart(7, "0")).join("").slice(0, 18);
  }
  const latMs = () => Math.round((musica.latencia || 0) * 1000);
  function regAbre(n) {
    if (!P || !P.prueba) return;
    P.reg = FP.abre(n, tMusica, performance.now(), P.tiempo, latMs(), P.uSig);
    P.uSig = "";
    anotaPulsos();
  }
  // Los pulsos que la música programó desde la última vez.
  function anotaPulsos() {
    const r = P && P.reg;
    if (!r) return;
    for (const p of musica.pulsosDesde(r.pn)) { r.pn = p.n; FP.pulso(r, p.t); }
  }
  function anota(letra, bala) { if (P && P.reg) FP.evento(P.reg, letra, tMusica, bala ? bala.k : 0); }
  function regCierra(fin) {
    if (!P || !P.reg) return;
    FP.cierra(P.prueba, P.reg, fin, tMusica, performance.now(), P.tiempo, P.puntos, P.llamas, { b: P.sinteticas - P.sintAntes, d: P.mando - P.mandoAntes });
    P.sintAntes = P.sinteticas; P.mandoAntes = P.mando;
    P.reg = null;
  }
  /* Las entradas que no hizo una persona: un script que despacha teclas o
     toques da isTrusted falso. El mando (juegos/audio/mando.js) también
     despacha teclas, marcadas con __mando: esas valen si de verdad hay un
     mando conectado. */
  function cuentaEntrada(e) {
    if (!P || !e || e.isTrusted) return;
    let mando = false;
    try { mando = !!e.__mando && Array.from((navigator.getGamepads && navigator.getGamepads()) || []).some(g => g && g.connected); } catch (err) { mando = false; }
    if (mando) P.mando++; else P.sinteticas++;
  }

  function nuevaPartida() {
    return {
      jornada: 1, j: null, acto: 1, completadas: 0,
      puntos: 0, llamas: M.LLAMAS_INICIO, notas: 0, cadena: 0, cadenaT: 0,
      luces: 430,                 // las luces del cielo (ver apagaEstrella)
      sinDanio: true, disparosJ: 0, aciertosJ: 0, fragJ: [], ecoJ: [],
      mensajerasRest: 0, tMensajera: 0, fuegoAcum: 0, picadaAcum: 0,
      acogidas: 0, apagadasLumbre: 0, albaGolpes: 0, tiempo: 0, reintentos: 0,
      stats: { disparos: 0, aciertos: 0, afinados: 0, apagadas: 0, mejorRes: 1, danios: 0, cartas: 0 },
      terminando: 0, fuentes: {},
      prueba: null, reg: null, msjK: 0, tocada: false, legado: false, sinteticas: 0, mando: 0, sintAntes: 0, mandoAntes: 0,
      // El taller: niveles de cada mejora, brasas sin gastar y lo comprado
      // para la próxima jornada (va a la prueba, ver regAbre).
      mej: M.mejorasVacias(), brasas: 0, uSig: "", gastadas: 0,
      // Cómo empezó la jornada en curso (después del taller): es lo que se
      // guarda para retomar la travesía (ver guardaPunto). `perdidasPend`:
      // las llamas que una travesía retomada ya había perdido en ella.
      llamasJ0: M.LLAMAS_INICIO, puntosJ0: 0, notasJ0: 0, lucesJ0: 430, uJ: "", perdidasPend: 0
    };
  }
  function nuevoFanal() {
    return { x: W / 2, vx: 0, invul: 0, campana: 0, campanaT: 0, pabilo: 0, lente: 0, cool: 0, remo: 0, apagado: 0, viento: 0, radioExtra: 0, aro: 0, enredo: 0, pulsoT: 0, mudo: 0, calor: 0, capullo: 0, capX: 0, capT: 0, posadas: 0, sacude: 0 };
  }
  /* El arma y el fanal de ahora (con las mejoras compradas). */
  const arma = () => M.armas(P ? P.mej : null);
  const naveF = () => M.nave(P ? P.mej : null);
  const topeLlamas = () => M.llamasMax(P ? P.mej : null);
  /* ¿Esta jornada es todavía de la historia (con su relato y sus giros)? */
  const enHistoria = () => P && P.jornada <= M.JORNADAS_HISTORIA;
  const actoVisual = j => (j ? j.acto : 1);                          // 1..4 y 6..8 historia, 5 sin fin
  const formaDe = j => (j && j.acto === 5 ? j.actoBase : j ? j.acto : 1); // de qué acto son las polillas
  const multiplicador = () => M.resonancia(P ? P.notas : 0);

  /* ================================================================
     Cascos hundidos (los escudos)
     ================================================================ */
  function creaNaufragios(acto, n) {
    // En los cascos (acto V) son seis y derivan: escudos que se mueven.
    const pos = n === 6 ? [10, 50, 90, 130, 170, 210] : [48, 96, 144, 192];
    return pos.map((cx, i) => ({ x: cx - 12, y: M.Y_NAUFRAGIOS - 6, w: 24, h: 12, pix: S.naufragio(acto), cv: S.lienzo(24, 12), sucio: true, vx: n === 6 ? (i % 2 ? -1 : 1) * azar(4, 8) : 0 }));
  }
  /* Un casco chico (lo que deja un pecio del Casco al caer). */
  function cascoChico(x) {
    const pix = S.naufragio(6).slice(4).map(f => f.slice(6, 18));
    return { x: Math.round(x - 6), y: M.Y_NAUFRAGIOS + 0, w: 12, h: pix.length, pix, cv: S.lienzo(12, pix.length), sucio: true, vx: 0 };
  }
  /* Los cascos que derivan dan la vuelta por los costados. */
  function derivaNaufragios(dt) {
    for (const n of naufragios) {
      if (!n.vx) continue;
      n.fx = (n.fx == null ? n.x : n.fx) + n.vx * dt;
      if (n.fx > W + 2) n.fx = -n.w - 2; else if (n.fx < -n.w - 2) n.fx = W + 2;
      n.x = Math.round(n.fx);
    }
  }
  function pintaNaufragio(n) {
    const c = n.cv.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, n.w, n.h);
    n.pix.forEach((fila, y) => fila.forEach((col, x) => { if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); } }));
    n.sucio = false;
  }
  /* ¿Hay casco en este punto? Devuelve el casco y la coordenada local. */
  function naufragioEn(px, py) {
    for (const n of naufragios) {
      const lx2 = Math.floor(px - n.x), ly2 = Math.floor(py - n.y);
      if (lx2 >= 0 && ly2 >= 0 && lx2 < n.w && ly2 < n.h && n.pix[ly2][lx2]) return { n, lx: lx2, ly: ly2 };
    }
    return null;
  }
  /* Rompe un pedazo del casco, con borde mordido. */
  function erosiona(n, cx, cy, r) {
    for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.hypot(x, y);
      if (d <= r || (d <= r + 1.2 && Math.random() < 0.45)) {
        const yy = cy + y, xx = cx + x;
        if (n.pix[yy] && xx >= 0 && xx < n.w) n.pix[yy][xx] = null;
      }
    }
    n.sucio = true;
  }

  /* ================================================================
     Partículas, destellos y textos que flotan
     ================================================================ */
  function chispas(x, y, n, colores, vel, vida, tipo) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = azar(vel * 0.3, vel);
      particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: azar(vida * 0.5, vida), max: vida, col: colores[i % colores.length], tipo: tipo || "chispa", g: tipo === "polvo" ? 18 : 0 });
    }
    if (particulas.length > 600) particulas.splice(0, particulas.length - 600);
  }
  function anillo(x, y, col, r) { particulas.push({ x, y, vx: 0, vy: 0, vida: 0.45, max: 0.45, col, tipo: "anillo", r: r || 14 }); }
  function destella(x, y, r, i, dur) { destellos.push({ x, y, r, i: i || 1, t: 0, dur: dur || 0.25 }); }
  function flota(x, y, texto, col) { flotantes.push({ x, y, texto: String(texto), col: col || "#ffd27a", vida: 1.1 }); }
  function sacude(cuanto) { fx.trauma = Math.min(1, fx.trauma + cuanto * opciones.sacudida); }
  function relampago(col, a) { fx.flashColor = col; fx.flash = Math.max(fx.flash, a * (opciones.destellos ? 0.35 : 1)); }
  /* Un aviso breve sobre el lienzo (carta recuperada, llama extra…). */
  let avisoT = 0;
  function avisa(texto) { const a = $("aviso"); a.textContent = texto; a.classList.add("ver"); avisoT = 2.4; }

  /* ================================================================
     La formación
     ================================================================ */
  function empiezaOleada(j) {
    const f = M.formacion(j), acto = actoVisual(j), forma = formaDe(j);
    form = { x: Math.round((W - f.ancho) / 2), y: M.Y_FORMACION, dir: 1, ancho: f.ancho, bajar: 0, empuje: 0, cuadro: 0, entrando: true, total: f.lista.length, restan: f.lista.length, t: 0 };
    polillas = f.lista.map(p => {
      const img = banco.polilla(acto, p.tipo, 0, forma);
      const retraso = p.col * 0.06 + (j.filas.length - 1 - p.fila) * 0.12 + Math.random() * 0.15;
      const lado = p.col < j.cols / 2 ? -1 : 1;
      return Object.assign({}, p, {
        viva: true, estado: "entrando", w: img.width, h: img.height, flash: 0, t: -retraso,
        dur: azar(1.1, 1.6), ox: W / 2 + lado * azar(60, 140), oy: -20 - Math.random() * 40, x: -50, y: -50, fase: Math.random() * 6.28
      });
    });
  }
  /* Dónde está el hueco de una polilla en la formación ahora. */
  function hueco(p) {
    const j = P.j, der = j.deriva || 0;
    // La marea: la formación entera sube y baja con la luna.
    const marea = j.marea ? Math.sin(form.t * 1.1) * j.marea : 0;
    return { x: form.x + p.dx + Math.sin(form.t * 1.4 + p.fase) * der * 0.4, y: form.y + p.dy + marea + Math.sin(form.t * 2 + p.fase + p.col * 0.4) * der * 0.5 };
  }

  function actualizaFormacion(dt) {
    const j = P.j, dif = j.acto === 5 ? 1 : 1;
    form.t += dt;
    let entrando = false, vivas = 0, minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of polillas) {
      if (!p.viva) continue;
      vivas++;
      p.flash = Math.max(0, p.flash - dt);
      const h = hueco(p);
      if (p.estado === "entrando") {
        p.t += dt;
        const k = clamp(p.t / p.dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
        // Entran en arco, como polillas que se acomodan alrededor de una luz.
        p.x = lerp(p.ox, h.x, e) + Math.sin(k * Math.PI) * 26 * (p.ox < W / 2 ? 1 : -1);
        p.y = lerp(p.oy, h.y, e);
        if (k >= 1) p.estado = "fila"; else entrando = true;
      } else if (p.estado === "fila") {
        p.x = h.x; p.y = h.y;
      } else if (p.estado === "picada") {
        actualizaPicada(p, dt);
      } else if (p.estado === "vuelve") {
        p.t += dt;
        const k = clamp(p.t / 1.2, 0, 1), e = suave(k);
        p.x = lerp(p.ox, h.x, e); p.y = lerp(p.oy, h.y, e);
        if (k >= 1) p.estado = "fila";
      }
      if (p.estado === "fila") { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h); }
    }
    form.restan = vivas;
    if (form.entrando && !entrando) form.entrando = false;
    if (form.entrando || vivas === 0) return;

    // La marcha: lenta con la formación entera y rápida con pocas. El
    // empujón de cada pulso (form.empuje) es lo que la hace latir.
    const fr = form.restan / form.total;
    const v = j.paso * 4.6 * (1 + 2.3 * Math.pow(1 - fr, 1.6)) * dif;
    form.empuje = Math.max(0, form.empuje - dt * 7);
    form.x += form.dir * v * (1 + 1.6 * form.empuje) * dt;
    if (minX !== Infinity && ((form.dir > 0 && maxX > W - 5) || (form.dir < 0 && minX < 5))) {
      form.dir *= -1;
      form.bajar += j.acto >= 3 ? 7 : 6;
    }
    if (form.bajar > 0) { const d = Math.min(form.bajar, 36 * dt); form.y += d; form.bajar -= d; }

    // Si la formación pisa los cascos, los va rompiendo.
    if (maxY > M.Y_NAUFRAGIOS - 7) {
      for (const p of polillas) if (p.viva && p.estado === "fila") {
        const hit = naufragioEn(p.x + p.w / 2, p.y + p.h);
        if (hit) erosiona(hit.n, hit.lx, hit.ly, 3);
      }
    }
    // Si llega a la línea del fanal, te alcanza: pierdes una llama y la
    // formación retrocede (no es el fin, es una herida).
    if (maxY > M.Y_LIMITE && estado === "juego") {
      golpeFanal("formacion");
      form.y -= 38;
    }

    // Disparos de la formación.
    P.fuegoAcum += j.fuego * dt;
    while (P.fuegoAcum >= 1) {
      P.fuegoAcum -= 1;
      if (escamas.filter(e => !e.jefe && !e.ascua && !e.fugaz).length < j.balas) disparaFormacion();
    }
    // Picadas: polillas que dejan la fila y bajan hacia la luz.
    P.picadaAcum += (j.picada || 0) * dt;
    while (P.picadaAcum >= 1) {
      P.picadaAcum -= 1;
      const c = polillas.filter(p => p.viva && p.estado === "fila" && (p.tipo !== "a" || j.acto >= 2));
      if (c.length) { const p = c[Math.floor(Math.random() * c.length)]; p.estado = "picada"; p.t = 0; p.vx = 0; p.vy = -40; p.disparo = j.acto >= 2; }
    }
    // La seda: de vez en cuando una polilla de la fila cuelga un hilo hasta
    // abajo. Tocarlo no quita llamas: enreda los remos un momento.
    if (j.hilos) {
      P.hiloAcum = (P.hiloAcum || 0) + j.hilos * dt;
      while (P.hiloAcum >= 1) {
        P.hiloAcum -= 1;
        const c = polillas.filter(p => p.viva && p.estado === "fila" && !hilos.some(h => h.p === p));
        if (c.length && hilos.length < 4) hilos.push({ p: c[Math.floor(Math.random() * c.length)], t: 0, dur: azar(3.2, 4.6), largo: 0 });
      }
    }
    // El firmamento: cada tanto cae una estrella fugaz en diagonal. Antes
    // titila un momento donde va a aparecer.
    if (j.fugaces) {
      P.fugazAcum = (P.fugazAcum || 0) + j.fugaces * dt;
      while (P.fugazAcum >= 1) {
        P.fugazAcum -= 1;
        const izq = Math.random() < 0.5, x = izq ? azar(10, W * 0.45) : azar(W * 0.55, W - 10);
        escamas.push(nuevaEscama(x, azar(30, 70), (izq ? 1 : -1) * azar(55, 75), azar(105, 125), { fugaz: true, espera: 0.7, estilo: 10 }));
      }
    }
  }
  /* Los hilos de seda: bajan desde su polilla, cuelgan un rato y se van. */
  function actualizaHilos(dt) {
    for (let i = hilos.length - 1; i >= 0; i--) {
      const h = hilos[i];
      h.t += dt;
      if (h.p) { if (!h.p.viva || h.p.estado !== "fila") { hilos.splice(i, 1); continue; } h.x = h.p.x + h.p.w / 2; h.y0 = h.p.y + h.p.h; }
      h.largo = Math.min(H - h.y0, h.largo + 260 * dt);
      if (h.t > h.dur) { hilos.splice(i, 1); continue; }
      if (estado === "juego" && h.y0 + h.largo > M.Y_FANAL - 6 && Math.abs(h.x - F.x) < 3.5 && !F.apagado) {
        if (F.enredo <= 0) { chispas(F.x, M.Y_FANAL - 8, 6, ["#f2ece2", "#ffffff"], 20, 0.5, "polvo"); musica.sfx.roce(F.x); }
        F.enredo = 1.1;
      }
    }
  }
  /* Una polilla en picada: sube un poco, se deja caer hacia la llama con un
     aleteo, y si se pasa, vuelve a entrar por arriba. */
  function actualizaPicada(p, dt) {
    p.t += dt;
    const atraccion = P.j.acto >= 3 ? 1.6 : 1;                         // en lo oscuro, la luz atrae más
    const ax = clamp((F.x - (p.x + p.w / 2)) * 1.4 * atraccion, -90, 90);
    p.vx = clamp(p.vx + ax * dt, -55, 55);
    p.vy = Math.min(p.vy + 120 * dt, 92);
    p.x += (p.vx + Math.sin(p.t * 9 + p.fase) * 22) * dt;
    p.y += p.vy * dt;
    if (p.disparo && p.y > 120 && Math.abs(p.x + p.w / 2 - F.x) < 18 && escamas.length < 10) {
      p.disparo = false;
      escamas.push(nuevaEscama(p.x + p.w / 2, p.y + p.h, 0, 92));
    }
    // Si llega a la llama, se quema en ella, y la llama se resiente.
    if (estado === "juego" && Math.abs(p.x + p.w / 2 - F.x) < 8 && Math.abs(p.y + p.h / 2 - (M.Y_FANAL - 3)) < 7) { mata(p, null, "quema"); golpeFanal("picada"); return; }
    if (p.y > H + 12) { p.estado = "vuelve"; p.t = 0; p.ox = hueco(p).x; p.oy = -16; p.x = p.ox; p.y = p.oy; }
  }
  /* Una escama. El augurio «veloz» la acelera (motor.js: aplicaAugurios). */
  function nuevaEscama(x, y, vx, vy, extra) {
    const v = (P && P.j && P.j.velEscama) || 1;
    return Object.assign({ x, y, vx: vx * v, vy: vy * v, t: 0, estilo: actoVisual(P.j) }, extra || {});
  }
  function disparaFormacion() {
    // Por columna, la polilla más baja; a veces la que está sobre el fanal.
    const porCol = {};
    for (const p of polillas) if (p.viva && p.estado === "fila") { const k = p.col; if (!porCol[k] || p.y > porCol[k].y) porCol[k] = p; }
    const cand = Object.values(porCol);
    if (!cand.length) return;
    let p = cand[Math.floor(Math.random() * cand.length)];
    if (Math.random() < P.j.apunta) p = cand.reduce((a, b) => (Math.abs(b.x + b.w / 2 - F.x) < Math.abs(a.x + a.w / 2 - F.x) ? b : a));
    const vel = ({ 1: 70, 2: 78, 3: 86, 4: 80, 5: 90, 6: 84, 7: 88, 8: 94, 9: 90, 10: 96, 11: 100 }[actoVisual(P.j)] || 86) * (P.j.acto === 5 ? 1 + (M.dificultad(P.jornada) - 1) * 0.25 : 1);
    const vx = P.j.acto >= 2 && Math.random() < P.j.apunta ? clamp((F.x - p.x) * 0.18, -16, 16) : 0;
    escamas.push(nuevaEscama(p.x + p.w / 2, p.y + p.h - 1, vx, vel));
  }

  /* ================================================================
     La Mensajera (la nave nodriza de esta historia)
     ================================================================ */
  function lanzaMensajera() {
    const izq = Math.random() < 0.5;
    msj = { x: izq ? -20 : W + 20, y: 27, vx: izq ? 30 : -30, t: 0, flash: 0 };
    musica.sfx.mensajera((W + 40) / 30);
  }
  function actualizaMensajera(dt) {
    if (!msj) return;
    msj.t += dt; msj.flash = Math.max(0, msj.flash - dt);
    msj.x += msj.vx * dt;
    msj.y = 27 + Math.sin(msj.t * 2.2) * 3;
    if (msj.x < -30 || msj.x > W + 30) msj = null;                    // se fue: la carta se perdió
  }
  /* La Mensajera alcanzada: puntos y una carta. En la historia, el próximo
     fragmento que el acto permite; en el sin fin, un eco. */
  function alcanzaMensajera() {
    // El valor sale de la semilla de la partida (no de Math.random): así la prueba lo puede recalcular.
    const pts = M.valorMensajera(P.prueba ? P.prueba.id : "fanal", P.jornada, P.msjK++);
    suma(pts, msj.x, msj.y, true);
    chispas(msj.x, msj.y, 22, ["#fff4e0", "#efe6d6", "#fff0c8"], 60, 0.9, "polvo");
    destella(msj.x, msj.y, 34, 1, 0.4);
    musica.sfx.muerte(msj.x, 7, true);
    apagaEstrella();
    let leida = false;
    if (enHistoria()) {
      const i = R.fragmentoSiguiente(new Set([...prog.frag, ...P.fragJ]), P.acto);
      if (i >= 0) { P.fragJ.push(i); leida = true; avisa("✉ Carta " + R.romano(i + 1) + " recuperada"); }
    } else {
      const i = R.ecoSiguiente(prog.ecos);
      if (!prog.ecos.includes(i)) { P.ecoJ.push(i); }
      P.ecoMostrar = i; leida = true; avisa("✉ Un eco");
    }
    if (leida) { musica.sfx.carta(); P.stats.cartas++; }
    else soltarPoder(msj.x, msj.y, true);                              // sin carta que dar, deja un poder
    msj = null;
  }

  /* ================================================================
     Poderes
     ================================================================ */
  const PODERES = ["pabilo", "lente", "campana", "aceite", "destello"];
  function soltarPoder(x, y, seguro) {
    if (!seguro && (poderes.length || Math.random() > 0.045 * naveF().probPoder)) return;
    const pesos = { pabilo: 30, lente: 20, campana: 25, aceite: P.llamas < topeLlamas() ? 12 : 0, destello: 15 };
    let r = Math.random() * Object.values(pesos).reduce((a, b) => a + b, 0), tipo = "pabilo";
    for (const k of PODERES) { r -= pesos[k]; if (r <= 0) { tipo = k; break; } }
    poderes.push({ x, y, tipo, t: 0 });
  }
  function tomaPoder(p) {
    anota({ pabilo: "p", lente: "l", campana: "c", aceite: "a", destello: "d" }[p.tipo]);
    musica.sfx.poder();
    anillo(F.x, M.Y_FANAL - 2, "#ffd27a", 18);
    const nombres = { pabilo: "Pabilo doble", lente: "Lente", campana: "Campana de vidrio", aceite: "Aceite: una llama", destello: "Destello" };
    avisa(nombres[p.tipo]);
    const dur = naveF().durPoder;
    if (p.tipo === "pabilo") F.pabilo = 12 * dur;
    if (p.tipo === "lente") F.lente = 8 * dur;
    if (p.tipo === "campana") F.campana = 1;
    if (p.tipo === "aceite") { P.llamas = Math.min(topeLlamas(), P.llamas + 1); pintaLlamas(); }
    if (p.tipo === "destello") {
      relampago("#fff6d8", 0.5); sacude(0.25);
      escamas = escamas.filter(e => e.muro);                           // se lleva todas las escamas (no los muros)
      hilos = [];
      const bajas = polillas.filter(q => q.viva && q.estado !== "entrando");
      const maxY = Math.max(-1, ...bajas.map(q => q.y));
      for (const q of bajas) if (q.y >= maxY - 3) mata(q, null, "destello"); // la fila más baja
      for (const l of larvas) l.vida = 0;
    }
  }

  /* ================================================================
     Puntos, golpes y muertes
     ================================================================ */
  function suma(n, x, y, grande) {
    const antes = P.puntos;
    P.puntos += n;
    const extra = M.llamasGanadas(antes, P.puntos);
    if (extra) { P.llamas = Math.min(topeLlamas(), P.llamas + extra); pintaLlamas(); avisa("Una llama más"); musica.sfx.poder(); }
    if (x != null) flota(x, y, n, grande ? "#fff6d8" : "#ffd27a");
  }
  function subeNota(afinado) {
    if (!afinado) return;
    const antes = multiplicador();
    P.notas++;
    const ahora = multiplicador();
    P.stats.mejorRes = Math.max(P.stats.mejorRes, ahora);
    if (ahora > antes) {
      anillo(F.x, M.Y_FANAL - 4, "#ffd27a", 22);
      flota(F.x, M.Y_FANAL - 16, "×" + ahora, "#fff6d8");
      const h = $("hudRes"); h.classList.remove("sube"); void h.offsetWidth; h.classList.add("sube");
    }
  }
  /* Una polilla apagada. */
  function mata(p, bala, causa) {
    if (!p.viva) return;
    p.viva = false;
    const i = "abc".indexOf(p.tipo);
    anota((bala ? "ABC" : causa === "quema" ? "JKL" : "GHI")[i < 0 ? 0 : i], bala);
    const acto = actoVisual(P.j);
    if (bala) subeNota(bala.afinado);
    const pts = M.puntosPolilla(acto, p.tipo, multiplicador(), bala && bala.afinado, P.j.vuelta);
    suma(pts, p.x + p.w / 2, p.y);
    P.cadena++; P.cadenaT = 2.5;
    musica.sfx.muerte(p.x + p.w / 2, P.cadena, p.tipo === "c");
    const pal = S.paletaPolilla(acto, p.tipo, formaDe(P.j));
    chispas(p.x + p.w / 2, p.y + p.h / 2, 14, [pal.b, pal.f, pal.e, pal.d], 46, 0.75, "polvo");
    destella(p.x + p.w / 2, p.y + p.h / 2, 22, 0.9, 0.22);
    P.stats.apagadas++;
    // En la ceniza, el polvo de las alas queda en el aire y baja despacio.
    if (P.j.ceniza && Math.random() < 0.5) cenizas.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, vy: azar(14, 22), r: azar(7, 10), t: 0 });
    // En la hoguera, una polilla apagada puede soltar un ascua que cae.
    if (P.j.ascuas && Math.random() < P.j.ascuas) escamas.push(nuevaEscama(p.x + p.w / 2, p.y + p.h, azar(-25, 25), azar(-30, 10), { ascua: true, g: 70, estilo: 8 }));
    // En la seda, su hilo se corta.
    hilos = hilos.filter(h => h.p !== p);
    apagaEstrella();
    soltarPoder(p.x + p.w / 2, p.y + p.h / 2, false);
  }
  /* Un golpe al fanal. */
  function golpeFanal(fuente) {
    if (F.invul > 0 || F.apagado || estado !== "juego") return;
    if (F.campana > 0) {                                               // la campana de vidrio aguanta uno
      F.campana = 0; F.invul = 0.9; F.campanaT = naveF().regenera;   // con vidrio templado, vuelve sola
      chispas(F.x, M.Y_FANAL - 4, 18, ["#e8dcc4", "#ffffff"], 70, 0.6);
      musica.sfx.roce(F.x); sacude(0.2); avisa("La campana se rompió");
      return;
    }
    P.llamas--; P.notas = 0; P.cadena = 0; P.sinDanio = false; P.stats.danios++;
    anota("g");
    P.fuentes[fuente || "?"] = (P.fuentes[fuente || "?"] || 0) + 1;
    if (window.__fanalTraza) window.__fanalTraza.push({ fuente, x: +F.x.toFixed(1), vx: Math.round(F.vx), cerca: escamas.filter(e => Math.abs(e.x - F.x) < 20 && e.y > 250).map(e => [Math.round(e.x), Math.round(e.y), Math.round(e.vx), Math.round(e.vy), e.estilo]) });
    F.invul = 2.2;
    sacude(0.6); fx.aberr = 0.5; relampago("#ff9a3c", 0.32);
    chispas(F.x, M.Y_FANAL - 6, 24, ["#ffcf6b", "#ff9a3c", "#fff6d8"], 80, 0.8);
    musica.sfx.danio();
    escamas = escamas.filter(e => e.muro || Math.hypot(e.x - F.x, e.y - M.Y_FANAL) > 36); // un respiro alrededor
    pintaLlamas();
    if (P.llamas <= 0) apagaFanal();
    else guardaPunto(P.jornada);                                       // si se corta aquí, la llama sigue perdida
  }

  /* ================================================================
     Los tiros del fanal
     ================================================================ */
  function disparar() {
    if (estado !== "juego" || F.apagado || F.cool > 0 || F.mudo > 0) return;   // mudo: la mecha mojada (la red de la Crisálida)
    const A = arma();
    // El patrón del arma (motor.js: armas); el pabilo suma una bala.
    let patron = A.patron.slice();
    if (F.pabilo > 0) patron = patron.length === 1 ? [{ dx: -3, vx: 0 }, { dx: 3, vx: 0 }] : patron.concat([{ dx: 0, vx: 0 }]);
    const propias = balas.filter(b => !b.chispa).length, max = A.tope * patron.length;
    if (propias >= max) return;
    // ¿Cayó en un pulso? Se compara con lo que se OYE (el audio sale con
    // algo de retraso por la tarjeta de sonido).
    const t = tMusica - musica.latencia, pc = musica.pulsoCercano(t);
    const afinado = M.juzgaPulso(t, pc.previo, pc.siguiente).afinado;
    const vel = F.lente > 0 ? -380 : afinado && A.rayo ? -360 : -300;
    const k = P.reg ? FP.disparo(P.reg, afinado, tMusica, latMs()) : 0;   // la bala recuerda su tiro (para la prueba)
    const perfora = F.lente > 0 || (afinado && A.rayo) ? 99 : afinado ? A.perfA : A.perfN;
    const nueva = (dx, vx, extra) => balas.push(Object.assign({ x: F.x + dx, y: M.Y_FANAL - 9, vx: vx || 0, vy: vel, afinado, perfora, dano: afinado ? A.danoA : A.danoN, tocados: new Set(), k, evo: A.evolucion, rayo: afinado && A.rayo }, extra || {}));
    const antes = balas.length;
    for (const p of patron) nueva(p.dx, p.vx);
    // La Antorcha: los tiros afinados sueltan dos chispas a los costados.
    if (afinado && A.chispas) for (const s of [-1, 1]) nueva(s * 2, s * 110, { chispa: true, perfora: 0, dano: A.danoN, rayo: false });
    F.cool = A.cool;
    P.stats.disparos++; P.disparosJ++;
    if (afinado) { P.stats.afinados++; anillo(F.x, M.Y_FANAL - 9, "#ffd27a", 10); fx.metro = 1; }
    else P.notas = Math.floor(P.notas / 4) * 4;                        // fuera del pulso se pierde lo que iba de la nota
    destella(F.x, M.Y_FANAL - 10, afinado ? 18 : 12, 0.8, 0.1);
    musica.sfx.disparo(F.x, afinado);
    // Fase 4. Envuelto en la Mortaja de la Crisálida, el tiro no sale: corta
    // seda. Y la sombra de la Esfinge contesta cada tiro (hasta seis en cola).
    if (F.capullo > 0) { balas.length = antes; cortaMortaja(afinado); }
    else if (jefe && jefe.sombra && jefe.sombra.t > 1 && !jefe.muerto && jefe.sombra.cola.length < 6) jefe.sombra.cola.push(0.2);
  }

  function actualizaBalas(dt) {
    for (let i = balas.length - 1; i >= 0; i--) {
      const b = balas[i];
      b.y += b.vy * dt; b.x += ((b.vx || 0) + (jefe && jefe.escora ? jefe.escora.k * 60 : 0)) * dt;   // la Escora del Casco (fase 5) tuerce los tiros
      let fuera = b.y < -6 || b.x < -6 || b.x > W + 6;
      // Contra las escamas: se anulan (los muros de la Esfinge no se rompen).
      for (let k = escamas.length - 1; k >= 0 && !fuera; k--) {
        const e = escamas[k];
        if (!e.muro && !e.devuelta && !(e.espera > 0) && Math.abs(e.x - b.x) < (e.prisma ? 5 : 3) && Math.abs(e.y - b.y) < (e.prisma ? 6 : 5)) {
          escamas.splice(k, 1); chispas(e.x, e.y, 5, ["#ffffff", "#ffd27a"], 30, 0.3);
          // El Prisma del Faro (fase 5): tirarle lo parte en tres astillas que vienen hacia ti.
          if (e.prisma) { for (const s of [-1, 0, 1]) escamas.push(nuevaEscama(e.x, e.y, clamp((F.x - e.x) * 0.5, -70, 70) + s * 40, 150, { jefe: true, estilo: 9 })); musica.sfx.escudo(); }
          if (!b.afinado && b.perfora < 1) fuera = true;
        }
      }
      // La Mensajera.
      if (!fuera && msj && Math.abs(b.x - msj.x) < 9 && Math.abs(b.y - msj.y) < 6) { P.aciertosJ++; P.stats.aciertos++; anota("M", b); alcanzaMensajera(); fuera = !b.perfora; }
      // El jefe y lo suyo.
      if (!fuera && jefe && golpeaJefe(b)) fuera = b.perfora-- <= 0;
      // Las polillas.
      if (!fuera) for (const p of polillas) {
        if (!p.viva || p.estado === "entrando" || b.tocados.has(p)) continue;
        if (b.x >= p.x && b.x <= p.x + p.w && b.y >= p.y && b.y <= p.y + p.h) {
          b.tocados.add(p);
          P.aciertosJ++; P.stats.aciertos++;
          p.vida -= b.dano; p.flash = 0.08;
          if (p.vida <= 0) mata(p, b);
          else { anota("N", b); musica.sfx.roce(p.x); chispas(b.x, b.y, 4, ["#ffffff"], 30, 0.25); }
          if (b.perfora-- <= 0) { fuera = true; break; }
        }
      }
      // Larvas, lumbres y sombras.
      if (!fuera) fuera = golpeaMenores(b);
      // Los cascos: la bala se queda y rompe un poco (la lente los atraviesa).
      if (!fuera && F.lente <= 0) {
        const hit = naufragioEn(b.x, b.y);
        if (hit) { erosiona(hit.n, hit.lx, hit.ly, 2); musica.sfx.escudo(); fuera = true; }
      }
      if (fuera) balas.splice(i, 1);
    }
  }
  /* Lo chico que también recibe tiros: larvas de la Nodriza, lumbres del
     alba y sombras. Devuelve si la bala se gastó. */
  function golpeaMenores(b) {
    for (const l of larvas) if (l.vida > 0 && Math.abs(b.x - l.x) < (l.huevo ? 5.5 : 4) && Math.abs(b.y - l.y) < (l.huevo ? 5.5 : 4)) {
      l.vida = 0; P.aciertosJ++; P.stats.aciertos++; anota("O", b); subeNota(b.afinado);
      suma(10 * multiplicador(), l.x, l.y); musica.sfx.muerte(l.x, ++P.cadena, false);
      chispas(l.x, l.y, 8, ["#c8a07a", "#fff0c8"], 35, 0.5, "polvo");
      return b.perfora-- <= 0;
    }
    for (const l of lumbres) if (l.viva && Math.abs(b.x - l.x) < 6 && Math.abs(b.y - l.y) < 5) {
      l.viva = false; P.apagadasLumbre++; P.aciertosJ++; P.stats.aciertos++; anota("Q", b);
      suma(5, l.x, l.y); musica.sfx.muerte(l.x, 0, false);
      chispas(l.x, l.y, 16, ["#fff6e0", "#ffd27a"], 40, 0.9, "polvo");
      return b.perfora-- <= 0;
    }
    for (const s of sombras) if (s.viva && Math.abs(b.x - s.x) < 6 && Math.abs(b.y - s.y) < 5) {
      s.viva = false; P.aciertosJ++; P.stats.aciertos++; anota("R", b); subeNota(b.afinado);
      suma(25 * multiplicador(), s.x, s.y); musica.sfx.muerte(s.x, ++P.cadena, false);
      chispas(s.x, s.y, 12, ["#2a1e30", "#6a4a7a"], 40, 0.6, "polvo");
      return b.perfora-- <= 0;
    }
    return false;
  }

  function actualizaEscamas(dt) {
    for (let i = escamas.length - 1; i >= 0; i--) {
      // golpeFanal reemplaza el arreglo (el respiro alrededor del fanal): lo
      // que ya no está, se salta.
      const e = escamas[i];
      if (!e) continue;
      if (e.espera > 0) { e.espera -= dt; continue; }                 // la fugaz todavía titila
      e.t += dt;
      if (e.g) e.vy = Math.min(e.vy + e.g * dt, 140);                 // las ascuas y los pecios caen
      if (e.polvo) e.vx += (F.viento * 0.45 - e.vx) * Math.min(1, dt * 3);   // el polvo de la Nodriza se va con su aleteo
      e.x += (e.vx + (e.estilo === 1 && !e.muro ? Math.sin(e.t * 18) * 14 : e.estilo === 2 || e.burbuja ? Math.sin(e.t * 4) * 6 : 0)) * dt;
      e.y += e.vy * dt;
      if (jefe && jefe.escora && e.jefe && !e.muro) e.x += jefe.escora.k * 34 * dt;   // y las escamas caen de lado
      if (e.vaiven) e.x += Math.cos(e.t * e.fr + e.ph) * e.vaiven * dt;   // el pan de oro de la Nodriza (fase 7) se mece
      // La resaca de la Luna (fase 3): lo que cae al agua vuelve hacia arriba, por donde cayó.
      if (e.y > H + 2 && e.jefe && !e.reflejo && !e.muro && jefe && jefe.resaca > 0 && !jefe.muerto) { e.reflejo = true; e.y = H + 2; e.vy = -Math.abs(e.vy) * 0.62; e.vx *= 0.5; e.g = 0; }
      let fuera = e.y > H + 4 || e.x < -6 || e.x > W + 6 || e.y < -40 || (e.reflejo && e.y < 232);
      // Un tizón de la Hoguera (fase 2) que llega al agua se queda ardiendo ahí.
      if (!fuera && e.tizon && e.y >= M.Y_FANAL - 4) {
        if (jefe && jefe.charcos) jefe.charcos.push({ x: e.x, t: 4.6, dur: 4.6 });
        chispas(e.x, M.Y_FANAL, 10, ["#ff6a20", "#ffd070"], 50, 0.5); musica.sfx.escudo();
        escamas.splice(i, 1); continue;
      }
      // La burbuja del Casco revienta en un anillo de escamas.
      if (!fuera && e.burbuja && e.y > e.revienta) {
        for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; escamas.push(nuevaEscama(e.x, e.y, Math.cos(a) * 46, Math.sin(a) * 46 + 30, { jefe: true, estilo: 6 })); }
        chispas(e.x, e.y, 8, ["#d0f0e8", "#5ab8a8"], 40, 0.4); musica.sfx.roce(e.x);
        escamas.splice(i, 1); continue;
      }
      // El pecio del Casco que llega abajo se queda: un casco chico más.
      if (!fuera && e.pecio && e.y >= M.Y_NAUFRAGIOS - 4) {
        if (naufragios.length < 9) naufragios.push(cascoChico(e.x));
        chispas(e.x, e.y, 8, ["#5a4a3a", "#8a6a3a"], 30, 0.5, "polvo"); musica.sfx.escudo();
        escamas.splice(i, 1); continue;
      }
      // Las luciérnagas (y los fanales liberados) se llevan las escamas que tocan.
      if (!fuera && !e.muro) for (const l of luciernagas) if (l.cd <= 0 && Math.abs(e.x - l.x) < 4 && Math.abs(e.y - l.y) < 4) { l.cd = l.libre ? 4 : 6; fuera = true; chispas(e.x, e.y, 5, ["#fff6d8", "#ffd27a"], 30, 0.3); break; }
      if (!fuera) {
        const hit = naufragioEn(e.x, e.y + 2);
        if (hit) { erosiona(hit.n, hit.lx, hit.ly, e.tizon ? 5 : e.muro ? 3 : 2); fuera = true; }
      }
      if (!fuera && estado === "juego" && Math.abs(e.x - F.x) < (e.pecio || e.grande ? 8 : 6.5) && e.y > M.Y_FANAL - 8 && e.y < M.Y_FANAL + 5) { golpeFanal(e.devuelta ? "devuelta" : e.muro ? "muro" : e.ascua ? "ascua" : e.pecio ? "pecio" : e.fugaz ? "fugaz" : "escama"); fuera = true; }
      if (fuera) { const k = escamas[i] === e ? i : escamas.indexOf(e); if (k >= 0) escamas.splice(k, 1); }
    }
  }

  /* ================================================================
     El fanal
     ================================================================ */
  function actualizaFanal(dt) {
    F.invul = Math.max(0, F.invul - dt); F.cool = Math.max(0, F.cool - dt);
    F.pabilo = Math.max(0, F.pabilo - dt); F.lente = Math.max(0, F.lente - dt);
    F.aro = Math.max(0, F.aro - dt); F.enredo = Math.max(0, F.enredo - dt); F.mudo = Math.max(0, F.mudo - dt);
    if (F.apagado) { F.apagado += dt; return; }
    const N = naveF();
    // El vidrio templado: la campana rota vuelve sola al rato.
    if (estado === "juego" && F.campana <= 0 && F.campanaT > 0) {
      F.campanaT -= dt;
      if (F.campanaT <= 0) { F.campana = 1; anillo(F.x, M.Y_FANAL - 3, "#e8dcc4", 14); musica.sfx.ui(5); }
    }
    // El faro errante: cada tanto, un pulso que barre las escamas cercanas.
    if (estado === "juego" && N.pulso) {
      F.pulsoT += dt;
      if (F.pulsoT >= N.pulso) {
        F.pulsoT = 0;
        escamas = escamas.filter(e => e.muro || Math.hypot(e.x - F.x, e.y - M.Y_FANAL) > 70);
        anillo(F.x, M.Y_FANAL - 4, "#fff6d8", 70); destella(F.x, M.Y_FANAL - 6, 60, 0.8, 0.4); musica.sfx.empuje();
      }
    }
    actualizaLuciernagas(dt, N);
    const puede = estado === "juego" || estado === "relato" || estado === "revelacion" || estado === "taller";
    let dir = 0;
    if (puede) {
      if (teclas.izq) dir -= 1;
      if (teclas.der) dir += 1;
      if (toque != null && Math.abs(toque - F.x) > 2) dir = Math.sign(toque - F.x) * Math.min(1, Math.abs(toque - F.x) / 14);
    }
    const objetivo = dir * N.vel * (F.enredo > 0 ? 0.45 : 1) * (1 - 0.12 * Math.min(4, F.posadas || 0));          // los hilos de seda enredan los remos
    // El Agua de vidrio de la Luna (fase 6): los remos no agarran y la barca resbala.
    const agarre = jefe && jefe.aguaVidrio > 0 && !jefe.muerto ? 0.14 : 1;
    F.vx += clamp(objetivo - F.vx, -1100 * agarre * (N.vel / 104) * dt, 1100 * agarre * (N.vel / 104) * dt); // aceleración con algo de inercia: es una barca
    F.vx += F.viento * dt;                                              // el aleteo de la Nodriza empuja
    const x0 = F.x;
    // El Horizonte de la Luna (fase 4): las dos orillas son la misma, y la barca da la vuelta.
    const vuelta = !!jefe && jefe.horizonte > 0 && !jefe.muerto;
    F.x += F.vx * dt;
    if (vuelta) { if (F.x < 3) F.x += W - 6; else if (F.x > W - 3) F.x -= W - 6; }
    else F.x = clamp(F.x, 10, W - 10);
    // La Mortaja de la Crisálida (fase 4): envuelta, la barca no se mueve.
    if (F.capullo > 0) { F.x = clamp(F.x, F.capX - 2, F.capX + 2); F.vx = 0; }
    // La cadena del Casco (fase 2), mientras está clavada, no se cruza.
    for (const n of anclas) if (n.plantada > 0) {
      const lado = x0 < n.x ? -1 : 1;
      if ((F.x - n.x) * lado < 7) { F.x = n.x + lado * 7; F.vx = 0; }
    }
    if (!vuelta && (F.x <= 10 || F.x >= W - 10)) F.vx = 0;
    F.remo += Math.abs(F.vx) * dt * 0.12 + (estado === "relato" || estado === "taller" ? dt * 2.4 : 0);
    // Disparo automático mientras se mantiene apretado (más seguido con la mecha corta).
    if (estado === "juego" && (teclas.fuego || toque != null)) {
      autoT -= dt;
      if (autoT <= 0) { disparar(); autoT = arma().auto; }
    } else autoT = 0;
    // La luz larga atrae los poderes.
    if (N.iman && estado === "juego") for (const p of poderes) {
      const dx = F.x - p.x, dy = M.Y_FANAL - 3 - p.y, d = Math.hypot(dx, dy);
      if (d < N.iman && d > 1) { p.x += (dx / d) * 70 * dt; p.y += (dy / d) * 50 * dt; }
    }
  }
  /* Las luciérnagas: las que te siguen (evolución del fanal) dan vueltas a
     la llama y se llevan las escamas que tocan; después de una se cansan
     un momento. Los fanales que se liberan de la Hoguera hacen lo mismo
     mientras dura ese encuentro. */
  function actualizaLuciernagas(dt, N) {
    const propias = luciernagas.filter(l => !l.libre).length;
    while (propias < N.luciernagas && luciernagas.filter(l => !l.libre).length < N.luciernagas) luciernagas.push({ a: Math.random() * 6.28, x: F.x, y: M.Y_FANAL - 10, cd: 0, f: Math.random() * 6 });
    const n = luciernagas.length;
    luciernagas.forEach((l, i) => {
      l.cd = Math.max(0, l.cd - dt);
      l.a += dt * (l.libre ? 1.6 : 2.4);
      const r = l.libre ? 24 : 15, ang = l.a + (i / Math.max(1, n)) * Math.PI * 2;
      const tx = F.x + Math.cos(ang) * r, ty = M.Y_FANAL - 12 + Math.sin(ang) * r * 0.45;
      const k = 1 - Math.exp(-dt * (l.libre ? 3 : 8));
      l.x += (tx - l.x) * k; l.y += (ty - l.y) * k;
    });
  }

  /* El radio de la luz de la llama ahora: el del acto, con las llamas que
     quedan, el latido del pulso, el temblor de la llama y el eclipse. */
  function radioLuz() {
    const base = (P && P.j ? M.actoDe(P.j).radio : M.ACTOS[cielo.hacia] ? M.ACTOS[cielo.hacia].radio : 90);
    const vidas = P ? Math.pow(Math.max(1, P.llamas) / 3, 0.22) : 1;
    const tiembla = 1 + Math.sin(tMusica * 13) * 0.025 + Math.sin(tMusica * 7.3) * 0.03;
    const apagando = F && F.apagado ? Math.max(0, 1 - F.apagado / 1.4) : 1;
    return (base + (F ? F.radioExtra : 0)) * vidas * tiembla * (1 + pulsoLuz * 0.07) * fx.eclipse * apagando * naveF().luz;
  }

  /* ================================================================
     Jefes
     ================================================================ */
  function empiezaJefe(j) {
    const tipo = j.jefe;
    jefe = { tipo, vida: M.vidaJefeJuego(j), max: M.vidaJefeJuego(j), x: W / 2, y: -50, t: 0, cd: 2.6, ataque: null, flash: 0, entrando: 2.6, fuerza: j.fuerza || 1, cuadro: 0, muerto: 0, alfa: 1 };
    if (tipo === "faro") { jefe.orbita = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2, r: 28 + (i % 2) * 5, viva: true, f: Math.random() * 6 })); jefe.respawn = 0; }
    if (tipo === "esfinge") { jefe.casaY = 82; jefe.visible = 0.4; }
    if (tipo === "hoguera") { jefe.orbita = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * Math.PI * 2, r: 36, viva: true, f: Math.random() * 6 })); jefe.libres = 0; }
    if (tipo === "luna") { jefe.casaY = 70; jefe.nueva = 0; }
    if (tipo === "constelacion") { jefe.casaY = 72; jefe.hermanas = PLEYADES.map(([dx, dy]) => ({ dx, dy, velada: false, flash: 0 })); jefe.giro = 0; jefe.abre = 1; jefe.tVelo = 2.5; jefe.sentido = 1; }
    if (tipo === "sol") jefe.casaY = 58;
    // La fase (2 o 3 en el sin fin): otro modelo y sus habilidades (ver
    // «Las fases 2 y 3»). `cdEsp` en 0: lo primero que hace es lo nuevo.
    jefe.fase = tipo === "alba" ? 1 : j.fase || 1;
    jefe.grado = j.grado || 0;                                         // el rigor de la fase 6 (motor.js: aplicaRigor)
    jefe.cdEsp = 0;
    if (tipo === "alba") { jefe.dist = M.DISTANCIA_ALBA; jefe.vida = 1; jefe.max = 1; jefe.entrando = 0; jefe.y = 20; jefe.x = W - F.x; jefe.tSombra = 4; }
    jefe.furia = j.furia || 1;                                         // el augurio de los grandes
    const info = R.JEFES[tipo];
    if (tipo !== "alba") {
      const num = jefe.fase > 1 ? " · " + R.romano(jefe.fase) + gradoTexto(jefe) : "";
      const vuelve = jefe.fase > 1 && R.FASES[tipo] ? R.FASES[tipo][jefe.fase] : null;   // cada fase se presenta con su epíteto
      $("jefeEpiteto").textContent = vuelve ? vuelve.epiteto : info.epiteto; $("jefeTitulo").textContent = info.nombre + num;
      muestra("capaJefe"); programa(() => oculta("capaJefe"), 2.7);
      $("jefeNombre").textContent = info.nombre + num; $("jefeBarra").hidden = false; pintaVidaJefe();
    }
    musica.estado({ jefe: tipo, vida: 1, cerca: 0 });
  }
  /* La vuelta dentro de su fase, como se escribe junto a ella: nada la
     primera vez, « (II)» la segunda, y así. El rigor cuenta desde la fase
     6 y la 7 empieza en el grado 2: su primera vuelta se escribe «VII». */
  const gradoTexto = o => { const v = o ? (o.grado || 0) - Math.max(0, (o.fase || 0) - 6) : 0; return v > 1 ? " (" + R.romano(v) + ")" : ""; };
  const faseJefe = () => (jefe.vida / jefe.max > 0.66 ? 0 : jefe.vida / jefe.max > 0.33 ? 1 : 2);
  function pintaVidaJefe() { $("jefeVida").style.width = Math.max(0, (jefe.vida / jefe.max) * 100) + "%"; }

  /* ¿La bala le dio al jefe (o a lo que lo protege)? */
  function golpeaJefe(b) {
    if (!jefe || jefe.muerto || b.tocados.has(jefe)) return false;
    const t = jefe.tipo;
    // Lo que las habilidades de las fases 2 y 3 ponen en el camino de un tiro.
    if (jefe.fase > 1 && golpeaEspecial(b)) return true;
    // Las Siete Hermanas: solo se les da a las encendidas.
    if (t === "constelacion") {
      if (jefe.entrando > 0) return false;
      const r = 5.5 * escalaJefe();
      for (const h of jefe.hermanas) {
        const p = posHermana(h);
        if (Math.abs(b.x - p.x) < r && Math.abs(b.y - p.y) < r) {
          if (h.velada) { b.tocados.add(jefe); chispas(b.x, b.y, 4, ["#8a80a8", "#5a5078"], 25, 0.3); musica.sfx.escudo(); return true; }
          h.flash = 0.08;
          hiereJefe(b, 1);
          // La que iba a estallar (Supernova): con los golpes que pide, se calma.
          if (h.nova && ++h.nova.golpes >= h.nova.pide) { h.nova = null; anillo(p.x, p.y, "#8cb2ff", 16); avisa("Se calmó"); musica.sfx.ui(5); }
          return true;
        }
      }
      return false;
    }
    if (t === "faro" || t === "hoguera") {
      // El enjambre que cubre al Faro, o los fanales presos en la Hoguera.
      for (const o of jefe.orbita) if (o.viva) {
        const { x: ox, y: oy } = posPreso(o);                            // en su órbita, o en el aire si la Hoguera lo arrojó
        if (Math.abs(b.x - ox) < 4.5 && Math.abs(b.y - oy) < 4) {
          o.viva = false; P.aciertosJ++; P.stats.aciertos++; anota("V", b); subeNota(b.afinado);
          suma(15 * multiplicador(), ox, oy); musica.sfx.muerte(ox, ++P.cadena, false);
          if (t === "faro") chispas(ox, oy, 8, ["#a9d6a2", "#e6f2d8"], 35, 0.5, "polvo");
          else {
            // Un fanal liberado: se suelta del fuego y viene a remar contigo.
            jefe.libres++; chispas(ox, oy, 12, ["#fff0c0", "#ffd070"], 40, 0.6);
            luciernagas.push({ a: Math.random() * 6.28, x: ox, y: oy, cd: 0, f: Math.random() * 6, libre: true });
            avisa(jefe.libres === 8 ? "Los soltaste a todos" : "Un fanal se soltó");
          }
          return true;
        }
      }
    }
    if (t === "alba") {
      const esc = escalaAlba(), w = 15 * esc, h = 10 * esc;
      if (Math.abs(b.x - jefe.x) < w / 2 && Math.abs(b.y - jefe.y) < h / 2) {
        // Todo lo que lances, volverá: el tiro empuja al Alba y vuelve hacia ti.
        jefe.dist = Math.min(M.DISTANCIA_ALBA, jefe.dist + M.EMPUJE_ALBA);
        P.albaGolpes++; anota("Z", b);
        escamas.push(nuevaEscama(jefe.x, jefe.y + h / 2, (F.x - jefe.x) * 0.45, 105, { devuelta: true, estilo: 4 }));
        musica.sfx.empuje(); chispas(b.x, b.y, 10, ["#fff6d8", "#ffd27a"], 40, 0.5);
        return true;
      }
      return false;
    }
    const caja = { nodriza: [20, 14, 0], faro: [11, 11, 2], esfinge: [14, 13, 0], casco: [22, 12, -2], crisalida: jefe.imago ? [22, 12, 0] : [11, 18, 2], hoguera: [20, 14, 2], luna: [16, 16, 0], sol: [20, 20, 0] }[t];
    // Escondido (la Esfinge en lo oscuro, la Luna nueva, el Sol eclipsado), la bala pasa.
    if (jefe.entrando > 0 || jefe.oculta) return false;
    const e = escalaJefe() * (t === "sol" && jefe.colapso ? jefe.colapso : 1);   // el Sol, cuando se cierra, es un blanco más chico
    if (Math.abs(b.x - jefe.x) < caja[0] * e && Math.abs(b.y - (jefe.y + caja[2] * e)) < caja[1] * e) {
      if (jefe.fase > 1 && escudoEspecial(b)) return true;
      // La Hoguera se defiende con los fanales que tiene presos: mientras
      // queden cinco o más, el fuego se come la mitad de cada golpe.
      hiereJefe(b, t === "hoguera" && jefe.orbita.filter(o => o.viva).length >= 5 ? 0.5 : 1);
      if (jefe.espejos && !jefe.muerto) finEspejismo(true);            // era la verdadera
      return true;
    }
    return false;
  }
  /* Lo que una habilidad de fase pone delante del jefe y un tiro puede
     tocar: la red de la Crisálida, un espejismo de la Esfinge, una baliza
     del Faro, el fuego fatuo del Casco. Devuelve si la bala dio en algo. */
  function golpeaEspecial(b) {
    if (jefe.fase >= 6 && golpeaFase6(b)) return true;
    const r = jefe.red;
    if (r && Math.abs(b.y - r.y) < 8) {
      const i = Math.floor(b.x / 12);
      if (r.segs[i]) { r.segs[i] = false; chispas(b.x, r.y, 5, ["#f2ece2", "#ffffff"], 26, 0.4, "polvo"); musica.sfx.roce(b.x); return true; }
    }
    if (jefe.espejos) for (const e of jefe.espejos) if (e.viva && Math.abs(b.x - e.x) < 14 * escalaJefe() && Math.abs(b.y - e.y) < 13 * escalaJefe()) {
      // Una falsa: se deshace, y el tiro vuelve.
      e.viva = false; musica.sfx.escudo();
      chispas(e.x, e.y, 16, ["#2a1e30", "#6a4a7a", "#d8cdb8"], 46, 0.7, "polvo");
      for (const k of [-1, 0, 1]) escamas.push(nuevaEscama(e.x, e.y + 10, clamp((F.x - e.x) * 0.35, -40, 40) + k * 14, 84, { jefe: true, estilo: 3 }));
      return true;
    }
    if (jefe.balizas) for (const z of jefe.balizas) if (z.t < z.dur && Math.abs(b.x - z.x) < 5 && Math.abs(b.y - z.y) < 5) {
      chispas(z.x, z.y, 6, ["#ffd884", "#b4542c"], 34, 0.4); musica.sfx.escudo();
      if (--z.vida <= 0) { z.t = z.dur + 1; pagaOrbita(b, z.x, z.y); }
      return true;
    }
    const w = jefe.fatuo;
    if (w && !w.vuelve && Math.abs(b.x - w.x) < 5 && Math.abs(b.y - w.y) < 6) {
      chispas(w.x, w.y, 6, ["#a8c8ff", "#ffffff"], 34, 0.4); musica.sfx.roce(w.x);
      if (--w.vida <= 0) { w.vuelve = true; jefe.cd = Math.max(jefe.cd, 1.2); pagaOrbita(b, w.x, w.y); }
      return true;
    }
    return false;
  }
  /* Un tiro que ya dio en el cuerpo del jefe, pero no lo hiere: la seda de
     la Crisálida, el Casco sin su llama, la Luna llena (que lo devuelve). */
  function escudoEspecial(b) {
    if (jefe.seda > 0) {
      jefe.seda -= b.afinado ? 3 : 1;
      chispas(b.x, b.y, 6, ["#f2ece2", "#ffffff"], 34, 0.4, "polvo"); musica.sfx.escudo();
      if (jefe.seda <= 0) { jefe.seda = 0; anillo(jefe.x, jefe.y, "#f2ece2", 30); chispas(jefe.x, jefe.y, 24, ["#f2ece2", "#c8bcb0"], 60, 0.9, "polvo"); musica.sfx.empuje(); }
    } else if (jefe.sinLlama) {
      chispas(b.x, b.y, 4, ["#5a4a3a", "#8a6a3a"], 26, 0.3, "polvo"); musica.sfx.escudo();
    } else if (jefe.espejo) {
      escamas.push(nuevaEscama(b.x, jefe.y + 14 * escalaJefe(), clamp((F.x - b.x) * 0.5, -60, 60), 112, { devuelta: true, estilo: 9 }));
      chispas(b.x, b.y, 8, ["#fff8e8", "#c8d8f0"], 40, 0.4); musica.sfx.escudo();
    } else return false;
    b.tocados.add(jefe);
    return true;
  }
  /* Un golpe que el jefe siente. Nunca más que el daño de la bala: el
     verificador cuenta cada golpe por lo más que pudo quitar. */
  function hiereJefe(b, escudo) {
    jefe.vida -= b.dano * escudo; jefe.flash = 0.07; b.tocados.add(jefe);
    if (jefe.ocaso) jefe.ocaso.empuje += 6;                              // el Ocaso del Sol (fase 4): cada golpe lo empuja hacia arriba
    P.aciertosJ++; P.stats.aciertos++; anota("X", b); subeNota(b.afinado);
    suma(5 * multiplicador(), null, null);
    musica.sfx.jefeGolpe(); chispas(b.x, b.y, 4, ["#ffffff", "#ffd27a"], 30, 0.3);
    pintaVidaJefe();
    musica.estado({ vida: jefe.vida / jefe.max });
    if (jefe.vida <= 0) muereJefe();
  }

  function actualizaJefe(dt) {
    if (!jefe) return;
    jefe.t += dt; jefe.flash = Math.max(0, jefe.flash - dt);
    if (jefe.muerto) {
      jefe.muerto += dt;
      // Los fanales que seguían presos en la Hoguera se sueltan y se van, cada uno por su lado.
      if (jefe.tipo === "hoguera") for (const o of jefe.orbita) { o.r += 34 * dt; o.a += dt * 0.3; }
      return;
    }
    // Con el fanal apagado, el jefe se queda quieto: ya no hay a quién atacar.
    if (estado === "muriendo" || estado === "fin") { jefe.ataque = null; jefe.haz = null; jefe.pista = null; F.viento = 0; return; }
    if (jefe.entrando > 0) {                                           // entra despacio mientras se presenta
      jefe.entrando -= dt;
      const casa = { faro: 64, esfinge: jefe.casaY, casco: 66, crisalida: 78, hoguera: 62, luna: jefe.casaY, constelacion: jefe.casaY, sol: jefe.casaY }[jefe.tipo] || 74;
      jefe.y = lerp(jefe.y, casa, 1 - Math.exp(-dt * 2.2));
      return;
    }
    if (jefe.tipo === "nodriza") nodriza(dt);
    else if (jefe.tipo === "faro") faro(dt);
    else if (jefe.tipo === "esfinge") esfinge(dt);
    else if (jefe.tipo === "alba") alba(dt);
    else if (jefe.tipo === "casco") casco(dt);
    else if (jefe.tipo === "crisalida") crisalida(dt);
    else if (jefe.tipo === "hoguera") hoguera(dt);
    else if (jefe.tipo === "luna") luna(dt);
    else if (jefe.tipo === "constelacion") constelacion(dt);
    else if (jefe.tipo === "sol") sol(dt);
    especiales(dt);
  }
  /* El vaivén de un jefe de lado a lado. Antes cada jefe escribía
     jefe.x = W/2 + sin(jefe.t·k)·amp, con el reloj del jefe, que ya corría
     mientras entraba: al terminar la entrada (o al volver de una picada, o
     al abrirse el capullo) la x saltaba de golpe hasta 70 px, y el jefe se
     «teletransportaba» a un costado. Ahora el vaivén tiene su propio reloj
     (`td`, que solo corre aquí y empieza en el centro, donde entra el
     jefe) y el jefe va hacia ese punto con velocidad tope: si el objetivo
     salta, lo alcanza deslizándose. */
  function vaivenX(dt, k, amp, v) {
    jefe.td = (jefe.td || 0) + dt;
    const obj = W / 2 + Math.sin(jefe.td * k) * amp, tope = (v || 90) * dt;
    jefe.x += clamp(obj - jefe.x, -tope, tope);
  }
  const objetivoX = (k, amp) => W / 2 + Math.sin((jefe.td || 0) * k) * amp;
  /* El planificador de ataques: elige uno, lo anuncia y lo deja correr. En
     las fases 2 y 3, cuando a su habilidad le toca (`cdEsp`), va ella
     ("esp2" o "esp3": las corre `especiales`, no la función del jefe). */
  function planifica(dt, elegir, enfriar) {
    if (jefe.ataque) return;
    jefe.cd -= dt * (jefe.fuerza > 1 ? Math.min(1.6, jefe.fuerza) : 1) * (jefe.furia || 1);
    if (jefe.cd > 0) return;
    jefe.ataque = { nombre: jefe.fase > 1 && jefe.cdEsp <= 0 ? siguienteEspecial() : elegir(), t: 0, hecho: 0 };
    jefe.cd = enfriar[faseJefe()];
    musica.sfx.aviso();
  }
  /* Abanico de escamas desde un punto, hacia abajo. */
  function abanico(x, y, n, abertura, vel, extra) {
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? 0 : -abertura + (2 * abertura * i) / (n - 1);
      escamas.push(nuevaEscama(x, y, Math.sin(a) * vel, Math.cos(a) * vel, Object.assign({ jefe: true }, extra || {})));
    }
  }

  /* La Nodriza: abanicos de escamas, larvas y el viento de sus alas. */
  function nodriza(dt) {
    const f = faseJefe();
    if (!jefe.ataque || jefe.ataque.nombre !== "aleteo") vaivenX(dt, 0.45, 66);
    jefe.y = 74 + Math.sin(jefe.t * 1.3) * 3;
    jefe.cuadro = Math.floor(jefe.t * (6 + f * 3)) % 3;
    planifica(dt, () => {
      const op = ["abanico", "abanico", "puesta", "aleteo"].concat(f === 2 ? ["espiral"] : []);
      return op[Math.floor(Math.random() * op.length)];
    }, [2.0, 1.6, 1.25]);
    const a = jefe.ataque;
    F.viento = 0;
    if (!a) return;
    a.t += dt;
    if (a.nombre === "abanico") {
      if (a.t > 0.6 && !a.hecho) { a.hecho = 1; abanico(jefe.x, jefe.y + 14, [5, 7, 9][f], 0.9, 70 + f * 8); musica.sfx.aleteo(); }
      if (a.t > 0.9) jefe.ataque = null;
    } else if (a.nombre === "puesta") {
      if (a.t > 0.5 && !a.hecho) {
        a.hecho = 1;
        for (let i = 0; i < 3 + f; i++) larvas.push({ x: jefe.x + azar(-6, 6), y: jefe.y - 10, vx: azar(-50, 50), vy: azar(-30, -5), t: 0, vida: 1, f: Math.random() * 6 });
      }
      if (a.t > 0.8) jefe.ataque = null;
    } else if (a.nombre === "aleteo") {
      if (!a.dir) a.dir = F.x < W / 2 ? -1 : 1;                         // empuja hacia el borde más cercano
      if (a.t > 0.8 && a.t < 2.2) {
        F.viento = a.dir * (150 + f * 30);
        if (Math.random() < 0.6) particulas.push({ x: a.dir > 0 ? -2 : W + 2, y: azar(150, 310), vx: a.dir * azar(140, 220), vy: azar(-8, 8), vida: 1.2, max: 1.2, col: "#e8d8c0", tipo: "viento" });
        if (!a.sono) { a.sono = 1; musica.sfx.aleteo(); sacude(0.15); }
      }
      if (a.t > 2.3) jefe.ataque = null;
    } else if (a.nombre === "espiral") {
      if (a.t > 0.5) { a.acum = (a.acum || 0) + dt; while (a.acum > 0.09) { a.acum -= 0.09; const ang = a.t * 5; abanico(jefe.x, jefe.y + 12, 1, 0, 60, {}); escamas[escamas.length - 1].vx = Math.sin(ang) * 60; escamas[escamas.length - 1].vy = 30 + Math.abs(Math.cos(ang)) * 40; } }
      if (a.t > 2.1) jefe.ataque = null;
    }
  }
  /* Las larvas: salen del abdomen, se abren y caen hacia la luz. */
  function actualizaLarvas(dt) {
    for (let i = larvas.length - 1; i >= 0; i--) {
      const l = larvas[i];
      if (l.vida <= 0) { larvas.splice(i, 1); continue; }
      l.t += dt;
      if (l.reclamo) {
        // El Reclamo de la Nodriza (fase 4): marcha con su bloque (lo mueve esp4Nodriza).
        const q = jefe && jefe.reclamo;
        if (q) { l.x = q.x + l.bx; l.y = q.y + l.by; continue; }
        l.reclamo = false; l.t = 0.7;
      }
      if (l.huevo) {
        // Un huevo de la Nidada (fase 2): va a su sitio, late y, si nadie lo
        // apaga antes, se abre en dos larvas.
        const k = 1 - Math.exp(-dt * 4);
        l.x += (l.hx - l.x) * k; l.y += (l.hy - l.y) * k;
        if (l.t > l.huevo) {
          l.vida = 0;
          for (const s of [-1, 1]) larvas.push({ x: l.x + s * 3, y: l.y, vx: s * azar(30, 55), vy: azar(-30, -10), t: 0.3, vida: 1, f: Math.random() * 6 });
          chispas(l.x, l.y, 10, ["#fff0c8", "#ffb468"], 40, 0.5, "polvo"); musica.sfx.roce(l.x);
        }
        continue;
      }
      // Las del Abrazo (Nodriza, fase 5) no se tiran: se acercan despacio y se posan.
      if (l.abrazo && l.t > 0.6) { l.vx += (clamp((F.x - l.x) * 2.5, -70, 70) - l.vx) * Math.min(1, dt * 3); l.vy = Math.min(l.vy + 60 * dt, 55); }
      else if (l.t > 0.6) { l.vx += clamp((F.x - l.x) * 2, -80, 80) * dt; l.vy = Math.min(l.vy + 90 * dt, 80); }
      else l.vy += 20 * dt;
      l.x += (l.vx + Math.sin(l.t * 10 + l.f) * 14) * dt; l.y += l.vy * dt;
      if (estado === "juego" && Math.abs(l.x - F.x) < 6 && Math.abs(l.y - (M.Y_FANAL - 3)) < 6) { l.vida = 0; if (l.abrazo) { F.posadas = (F.posadas || 0) + 1; musica.sfx.roce(F.x); } else golpeFanal("larva"); }
      const hit = !l.abrazo && naufragioEn(l.x, l.y);
      if (hit) { erosiona(hit.n, hit.lx, hit.ly, 2); l.vida = 0; }
      if (l.y > H + 8) l.vida = 0;
    }
  }

  /* El Faro Ciego: un haz que barre (los cascos dan sombra), anillos de
     destellos y un enjambre que lo protege. */
  function faro(dt) {
    const f = faseJefe();
    vaivenX(dt, 0.3, 20);
    jefe.y = 64 + Math.sin(jefe.t * 0.9) * 2;
    for (const o of jefe.orbita) o.a += dt * (0.8 + f * 0.2);
    jefe.respawn += dt;
    const max = [14, 11, 8][f];
    if (jefe.respawn > 2.5 && jefe.orbita.filter(o => o.viva).length < max) { jefe.respawn = 0; const o = jefe.orbita.find(q => !q.viva); if (o) o.viva = true; }
    planifica(dt, () => (Math.random() < 0.55 ? "barrido" : "destellos"), [1.9, 1.5, 1.2]);
    jefe.haz = null;
    const a = jefe.ataque;
    if (!a) return;
    a.t += dt;
    if (a.nombre === "barrido") {
      // El haz barre un SECTOR, no la pantalla entera: de un borde hacia el
      // centro (o pasado un poco). Las dos líneas punteadas del aviso marcan
      // dónde empieza y dónde termina, así que siempre hay por dónde salir
      // (o un casco bajo el que esconderse). En la segunda fase son dos haces
      // en espejo y lo seguro queda en el medio.
      if (a.a0 == null) {
        const s = Math.random() < 0.5 ? 1 : -1;
        a.a0 = 0.52 * s;                                                  // el borde de la pantalla, visto desde la lente
        a.a1 = (f >= 1 ? 0.12 : -0.08) * s;                               // hasta cerca del centro
        a.dur = [2.6, 2.2, 1.9][f];
      }
      const aviso = 0.9;
      if (a.t < aviso) jefe.haz = { angs: f >= 1 ? [a.a0, -a.a0] : [a.a0], fin: f >= 1 ? [a.a1, -a.a1] : [a.a1], aviso: true };
      else if (a.t < aviso + a.dur) {
        const k = (a.t - aviso) / a.dur, ang = lerp(a.a0, a.a1, suave(k));
        const parpadea = f === 2 && Math.sin(a.t * 23) > 0.55;           // ciego: el haz tartamudea
        jefe.haz = { angs: f >= 1 ? [ang, -ang] : [ang], aviso: false, apagado: parpadea };
        if (!a.sono) { a.sono = 1; musica.sfx.barrido(a.dur); }
        if (!parpadea) for (const ang2 of jefe.haz.angs) if (enHaz(ang2)) golpeFanal("haz");
      } else jefe.ataque = null;
    } else if (a.nombre === "destellos") {
      if (a.t > 0.5 && !a.hecho) { a.hecho = 1; const n = [9, 12, 15][f]; abanico(jefe.x, jefe.y + 2, n, 1.75, 55); relampago("#e6f6dc", 0.12); }
      if (a.t > 0.7) jefe.ataque = null;
    }
  }
  /* ¿El fanal está dentro del haz que sale a ese ángulo, sin un casco que
     le haga sombra? Se recorre la línea desde la lente buscando casco. */
  function enHaz(ang) {
    const lx2 = jefe.x, ly2 = jefe.y + 1, px = F.x, py = M.Y_FANAL - 3;
    const a = Math.atan2(px - lx2, py - ly2);
    if (Math.abs(a - ang) > 0.075) return false;
    const pasos = Math.ceil(Math.hypot(px - lx2, py - ly2) / 2);
    for (let i = 0; i < pasos; i++) { const t = i / pasos; if (naufragioEn(lerp(lx2, px, t), lerp(ly2, py, t))) return false; }
    return true;
  }

  /* La Esfinge: se esconde en lo oscuro, cae en picada, plantea su acertijo
     (un muro con un solo hueco) y eclipsa la luz. */
  function esfinge(dt) {
    const f = faseJefe(), a = jefe.ataque;
    if (!a || (a.nombre !== "picada" && a.nombre !== "esp2")) { vaivenX(dt, 0.33, 72); jefe.y = lerp(jefe.y, jefe.casaY + Math.sin(jefe.t * 0.8) * 3, 1 - Math.exp(-dt * 3)); }
    jefe.cuadro = Math.floor(jefe.t * 5) % 3;
    jefe.marcas = Math.max(0, (jefe.marcas || 0) - dt * 1.5);
    planifica(dt, () => {
      const op = ["picada", "acertijo", "polvo", "eclipse", "polvo"];
      return op[Math.floor(Math.random() * op.length)];
    }, [2.1, 1.7, 1.4]);
    if (!a) return;
    a.t += dt;
    if (a.nombre === "picada") {
      if (!a.n) { a.n = [1, 2, 3][f]; a.i = 0; a.etapa = "huye"; a.tt = 0; }
      a.tt += dt;
      if (a.etapa === "huye") { jefe.oculta = true; jefe.alfa = Math.max(0, 1 - a.tt / 0.35); if (a.tt > 0.35) { a.etapa = "marca"; a.tt = 0; a.cx = clamp(F.x + azar(-8, 8), 20, W - 20); jefe.x = a.cx; jefe.y = 28; musica.sfx.aviso(); } }
      else if (a.etapa === "marca") { jefe.marcas = 1; if (a.tt > 0.8) { a.etapa = "cae"; a.tt = 0; jefe.alfa = 1; jefe.oculta = false; musica.sfx.picada(); } }
      else if (a.etapa === "cae") {
        jefe.y += 300 * dt;
        if (estado === "juego" && Math.abs(jefe.x - F.x) < 16 && Math.abs(jefe.y - (M.Y_FANAL - 4)) < 12) golpeFanal("picada");
        const hit = naufragioEn(jefe.x, jefe.y + 10);
        if (hit) erosiona(hit.n, hit.lx, hit.ly, 4);
        if (jefe.y > H + 40) { a.i++; jefe.y = -40; if (a.i < a.n) { a.etapa = "huye"; a.tt = 0.35; } else { a.etapa = "vuelve"; a.tt = 0; jefe.x = objetivoX(0.33, 72); } }
      } else if (a.etapa === "vuelve") { jefe.y = lerp(-40, jefe.casaY, suave(Math.min(1, a.tt / 0.9))); if (a.tt > 0.9) jefe.ataque = null; }
    } else if (a.nombre === "acertijo") {
      if (!a.huecos) { a.huecos = [entero(2, 30)]; if (f >= 1) a.huecos.push(entero(2, 30)); a.k = 0; }
      jefe.marcas = 1;
      // La marca señala el hueco del muro que viene (no del que ya cayó).
      jefe.pista = a.k < a.huecos.length ? a.huecos[a.k] * 6 + 12 : null;
      const tMuro = 0.9 + a.k * 1.7;
      if (a.t > tMuro && a.k < a.huecos.length) {
        const g = a.huecos[a.k];
        for (let i = 0; i < 40; i++) if (i < g || i > g + 3) escamas.push(nuevaEscama(i * 6 + 3, 40, 0, 42, { muro: true, jefe: true, estilo: 3 }));
        a.k++;
        musica.sfx.eclipse();
      }
      if (a.k >= a.huecos.length && a.t > tMuro + 0.4) { jefe.pista = null; jefe.ataque = null; }
    } else if (a.nombre === "eclipse") {
      jefe.marcas = 0;
      if (a.t > 0.8 && !a.hecho) { a.hecho = 1; fx.eclipseObj = 0.45; musica.sfx.eclipse(); }
      if (a.hecho && a.t < 4.3 && Math.random() < dt * 6) escamas.push(nuevaEscama(azar(10, W - 10), 30, 0, azar(50, 70), { jefe: true, estilo: 3 }));
      if (a.t > 4.3) { fx.eclipseObj = 1; jefe.ataque = null; }
    } else if (a.nombre === "polvo") {
      if (a.t > 0.4 && !a.hecho) {
        a.hecho = 1; jefe.marcas = 1;
        for (const s of [-1, 1]) for (let k = 0; k < 2 + f; k++) { const ex2 = jefe.x + s * 28; escamas.push(nuevaEscama(ex2, jefe.y, clamp((F.x - ex2) * 0.25 + azar(-12, 12), -30, 30), 70 + k * 10, { jefe: true, estilo: 3 })); }
      }
      if (a.t > 0.7) jefe.ataque = null;
    }
  }

  /* El Alba: se acerca sola; cada tiro que la toca la aleja y vuelve hacia
     ti. Desde los costados bajan sombras, lo último de lo oscuro. */
  const escalaAlba = () => (jefe.dist > 380 ? 1 : jefe.dist > 130 ? 2 : 3);
  function alba(dt) {
    // Después del cruce, el Alba sigue su camino: pasa por el otro lado y se va.
    if (cielo.lleno > 0) {
      jefe.y += (cielo.lleno > 3 ? 24 : 5) * dt;
      if (Math.abs(jefe.x - F.x) < 34) jefe.x += Math.sign(jefe.x - F.x || 1) * 40 * dt;
      return;
    }
    jefe.dist = Math.max(0, jefe.dist - M.CIERRE_ALBA * dt);
    const cerca = 1 - jefe.dist / M.DISTANCIA_ALBA;
    jefe.y = lerp(20, 150, suave(cerca));                                 // desde el principio se ve, lejos, arriba
    jefe.x += clamp((W - F.x) - jefe.x, -34 * dt, 34 * dt);               // tu reflejo: va a donde no estás
    musica.estado({ cerca, vida: 1 - cerca });
    jefe.tSombra -= dt;
    if (jefe.tSombra <= 0 && jefe.dist > 60) {
      jefe.tSombra = azar(2.6, 3.8);
      const n = cerca > 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) { const izq = Math.random() < 0.5; sombras.push({ x: izq ? -8 : W + 8, y: azar(140, 228), vx: (izq ? 1 : -1) * azar(34, 46), t: 0, f: Math.random() * 6, viva: true }); }
    }
    if (jefe.dist <= 0 && estado === "juego") cruce();
  }
  /* El Casco: un fanal hundido que todavía arde. Tira el ancla (marca la
     columna antes), te arrastra hacia él con la resaca, suelta pecios que
     al caer se vuelven cascos chicos (escudos nuevos) y, al final, burbujas
     que revientan en un anillo de escamas. */
  function casco(dt) {
    const f = faseJefe();
    vaivenX(dt, 0.35, 60);
    jefe.y = 66 + Math.sin(jefe.t * 0.8) * 3;
    jefe.cuadro = Math.floor(jefe.t * 2) & 1;
    planifica(dt, () => {
      const op = ["ancla", "resaca", "pecios", "ancla"].concat(f >= 1 ? ["burbujas"] : []).concat(f === 2 ? ["burbujas", "ancla"] : []);
      return op[Math.floor(Math.random() * op.length)];
    }, [2.0, 1.6, 1.3]);
    const a = jefe.ataque;
    F.viento = 0;
    if (!a) return;
    a.t += dt;
    if (a.nombre === "ancla") {
      if (a.x == null) { a.x = clamp(F.x + azar(-6, 6), 12, W - 12); a.n = [1, 1, 2][f]; a.i = 0; }
      jefe.marcaX = a.x;
      if (a.t > 0.85 && !a.suelta) { a.suelta = { x: a.x, y: jefe.y + 16, vy: 0, sube: 0, t: 0 }; anclas.push(a.suelta); musica.sfx.ancla(); sacude(0.15); }
      if (a.suelta && !anclas.includes(a.suelta)) {   // la suya ya subió (la de la Cadena puede seguir clavada)
        if (++a.i < a.n) { a.x = clamp(F.x + azar(-10, 10), 12, W - 12); a.t = 0.2; a.suelta = null; }
        else { jefe.marcaX = null; jefe.ataque = null; }
      }
    } else if (a.nombre === "resaca") {
      if (a.t > 0.6 && a.t < 2.3) {
        F.viento = clamp(jefe.x - F.x, -1, 1) * (110 + f * 30);
        if (Math.random() < 0.5) particulas.push({ x: azar(0, W), y: azar(190, 300), vx: Math.sign(jefe.x - F.x || 1) * azar(80, 140), vy: 0, vida: 0.9, max: 0.9, col: "#7aa8a0", tipo: "viento" });
        a.acum = (a.acum || 0) + dt;
        if (a.acum > 0.55) { a.acum = 0; abanico(jefe.x, jefe.y + 18, 3, 0.35, 74); }
      }
      if (a.t > 2.4) jefe.ataque = null;
    } else if (a.nombre === "pecios") {
      if (a.t > 0.5 && !a.hecho) {
        a.hecho = 1; musica.sfx.aleteo();
        for (let i = 0; i < 2 + f; i++) escamas.push(nuevaEscama(jefe.x + azar(-14, 14), jefe.y + 10, azar(-45, 45), azar(-60, -25), { pecio: true, g: 80, jefe: true }));
      }
      if (a.t > 0.9) jefe.ataque = null;
    } else if (a.nombre === "burbujas") {
      if (a.t > 0.5 && !a.hecho) {
        a.hecho = 1;
        for (let i = 0; i < 2 + f; i++) escamas.push(nuevaEscama(jefe.x + (i - 1) * 22, jefe.y + 16, (i - 1) * 10, 38, { burbuja: true, revienta: azar(170, 215), jefe: true, estilo: 6 }));
      }
      if (a.t > 0.9) jefe.ataque = null;
    }
  }
  /* El ancla: cae recta, rompe lo que pisa y vuelve a subir despacio. */
  function actualizaAnclas(dt) {
    for (let i = anclas.length - 1; i >= 0; i--) {
      const n = anclas[i];
      n.t += dt;
      if (!n.sube) {
        if (n.plantada > 0) { n.plantada -= dt; if (n.plantada <= 0) n.sube = 1; continue; }   // la Cadena: clavada un rato
        n.vy = Math.min(n.vy + 520 * dt, 300); n.y += n.vy * dt;
        const hit = naufragioEn(n.x, n.y + 6);
        if (hit) erosiona(hit.n, hit.lx, hit.ly, 4);
        if (estado === "juego" && Math.abs(n.x - F.x) < 8 && n.y + 6 > M.Y_FANAL - 8 && n.y < M.Y_FANAL + 4) golpeFanal("ancla");
        if (n.y > H - 10) { if (n.queda) { n.plantada = n.queda; n.y = H - 10; } else n.sube = 1; sacude(0.2); chispas(n.x, H - 4, 10, ["#7aa8a0", "#d0f0e8"], 50, 0.6); }
      } else {
        n.y -= 110 * dt;
        if (!jefe || n.y < (jefe ? jefe.y + 16 : 0)) anclas.splice(i, 1);
      }
    }
  }

  /* La Crisálida: cuelga de un hilo y late. Baja hilos de seda (enredan),
     suelta crías que caen hacia la luz y lanza un giro de escamas. Al
     final se abre: sale la imago, más rápida, que sacude polvo de las alas. */
  function crisalida(dt) {
    const f = faseJefe();
    if (f === 2 && !jefe.imago) {
      jefe.imago = true; relampago("#fff0f8", 0.4); sacude(0.3); musica.sfx.cruce(); avisa("Se abrió el capullo");
      chispas(jefe.x, jefe.y, 40, ["#f2ece2", "#f0a8c8"], 70, 1.2, "polvo");
    }
    const vel = jefe.imago ? 0.7 : 0.45, amp = jefe.imago ? 80 : 46;
    vaivenX(dt, vel, amp);
    jefe.y = 78 + Math.sin(jefe.t * (jefe.imago ? 2.4 : 1.1)) * (jefe.imago ? 6 : 2);
    jefe.cuadro = Math.floor(jefe.t * (jefe.imago ? 9 : 2.5)) % 3;
    planifica(dt, () => {
      const op = jefe.imago ? ["polvo", "giro", "eclosion", "hilos", "polvo"] : ["hilos", "eclosion", "giro", "hilos"];
      return op[Math.floor(Math.random() * op.length)];
    }, [2.1, 1.7, 1.2]);
    const a = jefe.ataque;
    if (!a) return;
    a.t += dt;
    if (a.nombre === "hilos") {
      if (!a.xs) { const n = [3, 4, 5][f]; a.xs = Array.from({ length: n }, (_, i) => clamp((i === 0 ? F.x : azar(14, W - 14)) + azar(-4, 4), 10, W - 10)); jefe.marcasHilo = a.xs; }
      if (a.t > 0.8 && !a.hecho) { a.hecho = 1; jefe.marcasHilo = null; for (const x of a.xs) hilos.push({ x, y0: 0, t: 0, dur: 3.2, largo: 0, gotea: 0 }); musica.sfx.barrido(0.6); }
      if (a.t > 1.1) jefe.ataque = null;
    } else if (a.nombre === "eclosion") {
      if (a.t > 0.5 && !a.hecho) {
        a.hecho = 1;
        for (let i = 0; i < 3 + f; i++) larvas.push({ x: jefe.x + azar(-8, 8), y: jefe.y + 8, vx: azar(-60, 60), vy: azar(-30, -5), t: 0, vida: 1, f: Math.random() * 6, acto: 7 });
      }
      if (a.t > 0.8) jefe.ataque = null;
    } else if (a.nombre === "giro") {
      if (a.t > 0.4) { a.acum = (a.acum || 0) + dt; while (a.acum > 0.1) { a.acum -= 0.1; const ang = a.t * 4.2; escamas.push(nuevaEscama(jefe.x, jefe.y + 10, Math.sin(ang) * 58, 34 + Math.abs(Math.cos(ang)) * 38, { jefe: true, estilo: 7 })); } }
      if (a.t > 1.9) jefe.ataque = null;
    } else if (a.nombre === "polvo") {
      if (a.t > 0.45 && !a.hecho) { a.hecho = 1; abanico(jefe.x, jefe.y + 12, 11, 1.05, 78, { estilo: 7 }); musica.sfx.aleteo(); }
      if (a.t > 0.75) jefe.ataque = null;
    }
  }

  /* La Hoguera: cuelga del cielo hecha de fanales que arden juntos. Ocho
     arden presos a su alrededor: tirarles los suelta (y vienen contigo),
     y mientras queden cinco el fuego se come la mitad de cada golpe. Ataca
     con columnas de fuego (marcadas antes), una fuente de brasas y su
     abrazo, que te tira hacia ella. */
  function hoguera(dt) {
    const f = faseJefe();
    vaivenX(dt, 0.25, 30);
    jefe.y = 62 + Math.sin(jefe.t * 1.3) * 2;
    jefe.cuadro = Math.floor(jefe.t * 8) % 3;
    for (const o of jefe.orbita) o.a += dt * (0.6 + f * 0.25);
    planifica(dt, () => {
      const op = ["llamarada", "brasas", "abrazo", "llamarada"].concat(f === 2 ? ["brasas", "llamarada"] : []);
      return op[Math.floor(Math.random() * op.length)];
    }, [2.0, 1.6, 1.25]);
    const a = jefe.ataque;
    F.viento = 0;
    if (!a) return;
    a.t += dt;
    if (a.nombre === "llamarada") {
      if (!a.xs) {
        const n = [2, 3, 3][f];
        a.xs = [clamp(F.x + azar(-6, 6), 10, W - 10)];
        while (a.xs.length < n) { const x = azar(14, W - 14); if (a.xs.every(y => Math.abs(y - x) > 30)) a.xs.push(x); }
        a.dur = [1.1, 1.2, 1.4][f];
      }
      if (a.t < 0.95) columnas = a.xs.map(x => ({ x, aviso: true }));
      else if (a.t < 0.95 + a.dur) {
        if (!a.sono) { a.sono = 1; musica.sfx.llamarada(a.dur); sacude(0.12); }
        columnas = a.xs.map(x => ({ x, aviso: false }));
        // Un casco encima te da sombra.
        for (const c of columnas) if (estado === "juego" && Math.abs(c.x - F.x) < 7 && !naufragioEn(F.x, M.Y_NAUFRAGIOS + 2)) golpeFanal("llamarada");
      } else { columnas = []; jefe.ataque = null; }
    } else if (a.nombre === "brasas") {
      if (a.t > 0.5) { a.acum = (a.acum || 0) + dt; while (a.acum > 0.12) { a.acum -= 0.12; escamas.push(nuevaEscama(jefe.x + azar(-10, 10), jefe.y + 14, azar(-75, 75), azar(-90, -40), { ascua: true, g: 75, jefe: true, estilo: 8 })); } }
      if (a.t > 0.5 + [1, 1.3, 1.6][f]) jefe.ataque = null;
    } else if (a.nombre === "abrazo") {
      if (a.t > 0.5 && a.t < 2.4) {
        F.viento = clamp(jefe.x - F.x, -1, 1) * (100 + f * 30);
        a.acum = (a.acum || 0) + dt;
        if (a.acum > 0.7) { a.acum = 0; abanico(jefe.x, jefe.y + 16, 6 + f, 1.2, 62, { estilo: 8 }); }
      }
      if (a.t > 2.5) jefe.ataque = null;
    }
  }

  /* ================================================================
     Lo alto: la Luna, las Siete Hermanas y el Sol
     ================================================================ */

  /* La Luna: cruza el cielo en arco (más baja en los costados). Lanza
     crecientes de escamas con un solo hueco (marcado antes), tira de la
     marea (el fanal deriva de un lado al otro) y, en luna nueva, se apaga:
     no se le puede dar mientras caen sus reflejos. */
  function luna(dt) {
    const f = faseJefe();
    vaivenX(dt, 0.28, 74, 70);
    const dx = (jefe.x - W / 2) / 74;
    jefe.y = jefe.casaY + dx * dx * 10 + Math.sin(jefe.t * 0.9) * 2;
    jefe.cuadro = Math.floor(jefe.t * 3) % 3;
    planifica(dt, () => {
      const op = ["creciente", "marea", "creciente", "nueva"].concat(f >= 1 ? ["mareaViva"] : []).concat(f === 2 ? ["creciente", "nueva"] : []);
      return op[Math.floor(Math.random() * op.length)];
    }, [2.1, 1.7, 1.35]);
    const a = jefe.ataque;
    F.viento = 0;
    jefe.nueva = Math.max(0, (jefe.nueva || 0) - dt * 1.5);              // vuelve sola si no está en luna nueva
    if (!a) { jefe.oculta = jefe.nueva > 0.6; return; }
    a.t += dt;
    if (a.nombre === "creciente") {
      // El hueco cae del lado donde estás (más o menos): hay que ir a buscarlo.
      if (a.hueco == null) a.hueco = Math.atan2(F.x - jefe.x, M.Y_FANAL - jefe.y) + azar(-0.12, 0.12);
      jefe.pistaAng = a.hueco;
      if (a.t > 0.75 && !a.hecho) {
        a.hecho = 1; jefe.pistaAng = null;
        const n = [13, 15, 17][f], ab = 1.15;
        for (let i = 0; i < n; i++) {
          const ang = -ab + (2 * ab * i) / (n - 1);
          if (Math.abs(ang - a.hueco) < 0.14) continue;
          escamas.push(nuevaEscama(jefe.x, jefe.y + 14, Math.sin(ang) * 62, Math.cos(ang) * 62, { jefe: true, estilo: 9 }));
        }
        musica.sfx.aleteo();
      }
      if (a.t > 1.05) jefe.ataque = null;
    } else if (a.nombre === "marea" || a.nombre === "mareaViva") {
      const viva = a.nombre === "mareaViva", dur = viva ? 3.4 : 2.6;
      if (a.t > 0.6 && a.t < 0.6 + dur) {
        F.viento = Math.sin((a.t - 0.6) * 2.2) * (95 + f * 25);
        a.acum = (a.acum || 0) + dt;
        if (a.acum > (viva ? 0.32 : 0.5)) { a.acum = 0; escamas.push(nuevaEscama(azar(12, W - 12), 30, 0, azar(46, 60), { jefe: true, estilo: 9 })); }
        if (Math.random() < 0.5) particulas.push({ x: azar(0, W), y: azar(200, 300), vx: Math.sign(F.viento || 1) * azar(70, 120), vy: 0, vida: 0.8, max: 0.8, col: "#8ab0e8", tipo: "viento" });
        if (!a.sono) { a.sono = 1; musica.sfx.barrido(dur); }
      }
      if (a.t > 0.7 + dur) jefe.ataque = null;
    } else if (a.nombre === "nueva") {
      if (a.t < 0.6) jefe.nueva = Math.min(1, a.t / 0.6);
      else if (a.t < 3.6) {
        jefe.nueva = 1; fx.eclipseObj = 0.55;
        if (!a.sono) { a.sono = 1; musica.sfx.eclipse(); }
        a.acum = (a.acum || 0) + dt;
        if (a.acum > 0.22 - f * 0.04) { a.acum = 0; const x = azar(10, W - 10); escamas.push(nuevaEscama(x, 26, clamp((F.x - x) * 0.12, -14, 14), azar(56, 72), { jefe: true, estilo: 9 })); }
      } else { fx.eclipseObj = 1; jefe.ataque = null; abanico(jefe.x, jefe.y + 12, 5 + f * 2, 0.6, 70, { estilo: 9 }); }
    }
    jefe.oculta = jefe.nueva > 0.6;
  }

  /* Las Siete Hermanas: una constelación que se mueve entera. Solo se le
     da a las estrellas encendidas: las veladas (apagadas) paran la bala sin
     sentirla, y el velo cambia de unas a otras. Trazan su figura disparando
     una tras otra, dejan caer estrellas fugaces por una columna marcada,
     abren un anillo y, al final, se dispersan por todo el cielo. */
  // Las Pléyades, separadas para que cada hermana se distinga (y se pueda apuntar).
  const PLEYADES = [[-40, -6], [-24, -20], [-7, -9], [11, -22], [28, -7], [9, 12], [-17, 13]];
  function posHermana(h) {
    const e = escalaJefe() * jefe.abre, c = Math.cos(jefe.giro), s = Math.sin(jefe.giro);
    const p = { x: jefe.x + (h.dx * c - h.dy * s) * e, y: jefe.y + (h.dx * s + h.dy * c) * e * 0.8 };
    // La Alineación (fase 2): dejan la figura y se ponen en fila, de lado a lado.
    if (jefe.fila > 0.001) { p.x = lerp(p.x, xLinea(jefe.hermanas.indexOf(h)) + (jefe.corre || 0), jefe.fila); p.y = lerp(p.y, jefe.casaY - 4, jefe.fila); }
    // La Ronda (fase 4): bajan a rodear la barca.
    if (jefe.ronda > 0.001) { const q = posRonda(jefe.hermanas.indexOf(h)), k = suave(jefe.ronda); p.x = lerp(p.x, q.x, k); p.y = lerp(p.y, q.y, k); }
    return p;
  }
  function velaHermanas(f) {
    const n = [2, 3, 3][f], idx = jefe.hermanas.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, n);
    jefe.hermanas.forEach((h, i) => {
      const antes = h.velada;
      h.velada = idx.includes(i) && !h.nova;
      if (antes && !h.velada) { const p = posHermana(h); anillo(p.x, p.y, "#fff0c8", 8); }
    });
  }
  function constelacion(dt) {
    const f = faseJefe(), a = jefe.ataque;
    vaivenX(dt, 0.32, 56, 70);
    jefe.y = jefe.casaY + Math.sin(jefe.t * 0.7) * 4;
    jefe.giro += dt * (0.25 + f * 0.12) * jefe.sentido;
    jefe.cuadro = Math.floor(jefe.t * 4) & 1;
    for (const h of jefe.hermanas) h.flash = Math.max(0, h.flash - dt);
    jefe.tVelo -= dt;
    if (jefe.tVelo <= 0) { jefe.tVelo = [4, 3.4, 2.8][f]; velaHermanas(f); if (Math.random() < 0.3) jefe.sentido *= -1; }
    const abre = a && a.nombre === "dispersa" && a.t > 0.4 && a.t < 3.2 ? 2.1 : 1;
    jefe.abre += (abre - jefe.abre) * (1 - Math.exp(-dt * 3));
    planifica(dt, () => {
      const op = ["trazo", "fugaz", "anillo", "trazo"].concat(f >= 1 ? ["dispersa"] : []).concat(f === 2 ? ["fugaz", "dispersa"] : []);
      return op[Math.floor(Math.random() * op.length)];
    }, [2.0, 1.6, 1.3]);
    if (!a) return;
    a.t += dt;
    if (a.nombre === "trazo") {
      if (!a.orden) { a.orden = jefe.hermanas.map((_, i) => i); if (Math.random() < 0.5) a.orden.reverse(); a.k = 0; a.acum = 0; }
      if (a.t > 0.5) {
        a.acum += dt;
        const paso = [0.22, 0.18, 0.14][f];
        while (a.acum > paso && a.k < a.orden.length) {
          a.acum -= paso;
          const h = jefe.hermanas[a.orden[a.k++]], p = posHermana(h);
          h.flash = 0.12;
          const ddx = F.x - p.x, ddy = M.Y_FANAL - p.y, d = Math.hypot(ddx, ddy) || 1;
          escamas.push(nuevaEscama(p.x, p.y + 4, (ddx / d) * 72, (ddy / d) * 72, { jefe: true, estilo: 10 }));
          musica.sfx.nota(a.k % 7, 3, 0.05);
        }
      }
      jefe.trazo = a.orden.slice(0, a.k);
      if (a.k >= a.orden.length && a.acum > 0.4) { jefe.trazo = null; jefe.ataque = null; }
    } else if (a.nombre === "fugaz") {
      if (a.x == null) { a.x = clamp(F.x + azar(-6, 6), 10, W - 10); a.n = [1, 2, 3][f]; a.i = 0; a.tt = 0; }
      a.tt += dt; jefe.marcaX = a.x;
      if (a.tt > 0.8) {
        escamas.push(nuevaEscama(a.x, 20, 0, 240, { jefe: true, fugaz: true, grande: true, estilo: 10 }));
        musica.sfx.picada(); a.i++; a.tt = 0;
        if (a.i < a.n) { a.x = clamp(F.x + azar(-8, 8), 10, W - 10); musica.sfx.aviso(); }
        else { jefe.marcaX = null; jefe.ataque = null; }
      }
    } else if (a.nombre === "anillo") {
      if (a.t > 0.5 && !a.hecho) {
        a.hecho = 1;
        for (const h of jefe.hermanas) if (!h.velada) { const p = posHermana(h); abanico(p.x, p.y + 3, 3, 0.45, 58 + f * 6, { estilo: 10 }); }
        musica.sfx.aleteo();
      }
      if (a.t > 0.8) jefe.ataque = null;
    } else if (a.nombre === "dispersa") {
      if (a.t > 0.6 && a.t < 3.2) {
        a.acum = (a.acum || 0) + dt;
        if (a.acum > 0.2 - f * 0.03) {
          a.acum = 0;
          const h = jefe.hermanas[entero(0, 6)], p = posHermana(h);
          h.flash = 0.1;
          escamas.push(nuevaEscama(p.x, p.y + 4, azar(-10, 10), 64 + f * 8, { jefe: true, estilo: 10 }));
        }
      }
      if (a.t > 3.8) jefe.ataque = null;
    }
  }

  /* El Sol: lo último. Cuelga arriba, enorme, y no se mueve casi nada.
     Abre coronas de escamas en todas direcciones, baja rayos por columnas
     marcadas (un casco encima da sombra), suelta llamaradas que caen hacia
     la luz (se les puede tirar) y, herido, empuja con el viento solar y se
     deja eclipsar: mientras la Luna lo tapa no se le puede dar. */
  function corona(f, giro, vel) {
    const n = [16, 20, 24][f], v = vel || 54;
    for (let i = 0; i < n; i++) {
      const ang = ((i + giro) / n) * Math.PI * 2;
      escamas.push(nuevaEscama(jefe.x, jefe.y, Math.sin(ang) * v, Math.cos(ang) * v, { jefe: true, estilo: 11 }));
    }
    anillo(jefe.x, jefe.y, "#ffd070", 26 * escalaJefe());
  }
  function sol(dt) {
    const f = faseJefe();
    vaivenX(dt, 0.2, 40, 50);
    jefe.y = jefe.casaY + Math.sin(jefe.t * 0.6) * 2;
    jefe.cuadro = Math.floor(jefe.t * 5) % 3;
    planifica(dt, () => {
      const op = ["corona", "rayo", "llamaradas", "corona"].concat(f >= 1 ? ["viento", "eclipse"] : []).concat(f === 2 ? ["rayo", "eclipse"] : []);
      return op[Math.floor(Math.random() * op.length)];
    }, [1.9, 1.55, 1.2]);
    const a = jefe.ataque;
    F.viento = 0;
    if (!a) return;
    a.t += dt;
    if (a.nombre === "corona") {
      if (a.t > 0.55 && !a.hecho) { a.hecho = 1; corona(f, Math.random()); musica.sfx.empuje(); sacude(0.1); }
      if (a.t > 0.85) jefe.ataque = null;
    } else if (a.nombre === "rayo") {
      if (!a.xs) {
        const n = [2, 3, 4][f];
        a.xs = [clamp(F.x + azar(-6, 6), 10, W - 10)];
        while (a.xs.length < n) { const x = azar(14, W - 14); if (a.xs.every(y => Math.abs(y - x) > 28)) a.xs.push(x); }
        a.dur = [1.0, 1.1, 1.2][f];
      }
      if (a.t < 0.95) columnas = a.xs.map(x => ({ x, aviso: true, sol: true }));
      else if (a.t < 0.95 + a.dur) {
        if (!a.sono) { a.sono = 1; musica.sfx.llamarada(a.dur); sacude(0.12); }
        columnas = a.xs.map(x => ({ x, aviso: false, sol: true }));
        for (const c of columnas) if (estado === "juego" && Math.abs(c.x - F.x) < 7 && !naufragioEn(F.x, M.Y_NAUFRAGIOS + 2)) golpeFanal("rayo");
      } else { columnas = []; jefe.ataque = null; }
    } else if (a.nombre === "llamaradas") {
      if (a.t > 0.5 && !a.hecho) {
        a.hecho = 1; musica.sfx.llamarada(0.4);
        for (let i = 0; i < 3 + f; i++) larvas.push({ x: jefe.x + azar(-14, 14), y: jefe.y + 18, vx: azar(-60, 60), vy: azar(-30, -5), t: 0, vida: 1, f: Math.random() * 6, acto: 11 });
      }
      if (a.t > 0.8) jefe.ataque = null;
    } else if (a.nombre === "viento") {
      // El viento solar empuja hacia afuera, lejos del Sol, y deja caer fuego donde te lleva.
      if (!a.dir) a.dir = F.x < jefe.x ? -1 : 1;
      if (a.t > 0.6 && a.t < 2.6) {
        F.viento = a.dir * (120 + f * 30);
        a.acum = (a.acum || 0) + dt;
        if (a.acum > 0.2) { a.acum = 0; const x = clamp(F.x + a.dir * azar(14, 60), 8, W - 8); escamas.push(nuevaEscama(x, 30, -a.dir * 12, azar(70, 90), { jefe: true, estilo: 11 })); }
        if (Math.random() < 0.6) particulas.push({ x: a.dir > 0 ? azar(0, W / 2) : azar(W / 2, W), y: azar(150, 310), vx: a.dir * azar(140, 220), vy: azar(-8, 8), vida: 1, max: 1, col: "#ffd070", tipo: "viento" });
        if (!a.sono) { a.sono = 1; musica.sfx.aleteo(); sacude(0.15); }
      }
      if (a.t > 2.7) jefe.ataque = null;
    } else if (a.nombre === "eclipse") {
      const dur = 3.6;
      jefe.eclipse = clamp(a.t / dur, 0, 1);
      jefe.oculta = jefe.eclipse > 0.3 && jefe.eclipse < 0.75;
      fx.eclipseObj = jefe.oculta ? 0.5 : 1;
      if (jefe.oculta && !a.sono) { a.sono = 1; musica.sfx.eclipse(); }
      if (a.t > dur * 0.4 && !a.r1) { a.r1 = 1; corona(f, 0); }
      if (a.t > dur * 0.62 && !a.r2) { a.r2 = 1; corona(f, 0.5); }
      if (a.t > dur) { jefe.eclipse = null; jefe.oculta = false; fx.eclipseObj = 1; jefe.ataque = null; }
    }
  }

  /* ================================================================
     Las fases 2 y 3 (el sin fin, después del Sol)
     ================================================================
     Los mismos jefes, otra vez, y ya no son los mismos. Cambian por dos
     lados:
     - El MODELO: sprites.js dibuja a cada uno de nuevo en cada fase (más
       grande, herido en la 2, coronado en la 3). No es un tinte.
     - Una HABILIDAD propia por fase. La fase 2 estrena una; la 3 conserva
       esa y suma otra, y las va alternando. Es lo primero que hacen al
       llegar, y después vuelve cada tantos segundos, entre sus ataques de
       siempre. Su nombre se dice en pantalla (relato.js: FASES).

                       fase 2                fase 3
       Nodriza         Nidada                Polvo suspendido
       Faro            Balizas               Giro entero
       Esfinge         Espejismo             Laberinto
       Casco           Cadena                Fuego fatuo
       Crisálida       Capullo de seda       Telar
       Hoguera         Tizones               Honda
       Luna            Luna llena            Resaca de luz
       Siete Hermanas  Alineación            Supernova
       Sol             Canícula              Colapso

     Antes las dos fases eran las mismas para todos (cada ráfaga volvía en
     espejo, tres espinas giraban alrededor, anillos de choque al final):
     más escamas, pero ninguna pelea distinta. Eso se quitó.

     La fase 4 (tercera vuelta en adelante) suma una tercera habilidad por
     jefe: está más abajo, en «La fase 4»; la 5, la 6 y la 7, una cuarta,
     una quinta y una sexta, en «La fase 5», «La fase 6» y «La fase 7».

     Nada de esto toca la prueba (prueba.js): lo que un tiro apaga aquí usa
     letras que el verificador ya admite para ese jefe (`O` para los huevos
     de la Nodriza, `V` para una baliza del Faro, un fanal de la Hoguera o
     el fuego fatuo del Casco, que es de la fase 3), y lo demás (un
     espejismo, la red, la seda) se rompe sin anotar nada ni contar como
     acierto. Al jefe solo lo hiere `hiereJefe`, como siempre. */
  const escalaJefe = () => (jefe ? S.ESCALA_FASE[jefe.fase] || 1 : 1);
  const habilidad = n => { const f = R.FASES[jefe.tipo]; return f && f[n] ? f[n].hab : ""; };
  /* La habilidad que toca: en la fase 2, la suya; en la 3 alternan y en la
     4 a la 7 rotan todas, y siempre empieza la más nueva. `pideEsp`: la que
     pidió el gancho de pruebas. */
  function siguienteEspecial() {
    const orden = jefe.fase >= 7 ? [7, 2, 3, 4, 5, 6] : jefe.fase >= 6 ? [6, 2, 3, 4, 5] : jefe.fase >= 5 ? [5, 2, 3, 4] : jefe.fase >= 4 ? [4, 2, 3] : jefe.fase >= 3 ? [3, 2] : [2];
    jefe.turnoEsp = jefe.turnoEsp || 0;
    let n = orden[jefe.turnoEsp++ % orden.length];
    if (jefe.pideEsp) { n = clamp(jefe.pideEsp, 2, jefe.fase); jefe.pideEsp = 0; }
    // Desde la fase 6, cada grado de rigor la trae un poco antes (hasta 3,2 s).
    jefe.cdEsp = jefe.fase >= 6 ? Math.max(3.2, 5.5 - 0.35 * Math.max(0, (jefe.grado || 1) - 1)) : jefe.fase >= 5 ? 6 : jefe.fase >= 4 ? 6.5 : jefe.fase >= 3 ? 7.5 : 10;
    avisa("✦ " + habilidad(n));
    return "esp" + n;
  }
  /* Algo que un tiro apaga y que paga como lo que orbita a un jefe (`V`). */
  function pagaOrbita(b, x, y) {
    P.aciertosJ++; P.stats.aciertos++; anota("V", b); subeNota(b.afinado);
    suma(15 * multiplicador(), x, y); musica.sfx.muerte(x, ++P.cadena, false);
  }
  /* Corre las habilidades del jefe: la que está lanzando (ocupa su turno
     de ataque, como cualquier otro) y lo que dejaron las anteriores, que
     sigue vivo mientras él ataca con lo de siempre. */
  function especiales(dt) {
    if ((jefe.fase || 1) < 2 || jefe.tipo === "alba") return;
    jefe.cdEsp -= dt;
    const a = jefe.ataque, fn = ESPECIALES[jefe.tipo];
    if (fn) fn(dt, a && a.nombre === "esp2" ? a : null, a && a.nombre === "esp3" ? a : null, faseJefe());
    const fn4 = jefe.fase >= 4 && ESPECIALES4[jefe.tipo];
    if (fn4) fn4(dt, a && a.nombre === "esp4" ? a : null, faseJefe());
    const fn5 = jefe.fase >= 5 && ESPECIALES5[jefe.tipo];
    if (fn5) fn5(dt, a && a.nombre === "esp5" ? a : null, faseJefe());
    const fn6 = jefe.fase >= 6 && ESPECIALES6[jefe.tipo];
    if (fn6) fn6(dt, a && a.nombre === "esp6" ? a : null, faseJefe());
    const fn7 = jefe.fase >= 7 && ESPECIALES7[jefe.tipo];
    if (fn7) fn7(dt, a && a.nombre === "esp7" ? a : null, faseJefe());
  }

  /* La Nodriza. NIDADA: cuelga huevos en el aire; cada uno late y, si nadie
     lo apaga antes, se abre en dos larvas. POLVO SUSPENDIDO: sacude las
     alas y deja una cortina de polvo que baja muy despacio; su aleteo
     después la arrastra de lado. Los tiros le abren camino. */
  function espNodriza(dt, a2, a3, f) {
    if (a2) {
      if (a2.t > 0.6 && !a2.hecho) {
        a2.hecho = 1; musica.sfx.aleteo();
        const n = 3 + (f === 2 ? 1 : 0);
        for (let i = 0; i < n; i++) larvas.push({ x: jefe.x, y: jefe.y - 8, hx: clamp(28 + ((i + 0.5) / n) * (W - 56) + azar(-12, 12), 14, W - 14), hy: azar(150, 200), huevo: 3.6 - f * 0.3, vx: 0, vy: 0, t: 0, vida: 1, f: Math.random() * 6 });
      }
      if (a2.t > 1) jefe.ataque = null;
    }
    if (a3) {
      if (a3.t > 0.6 && !a3.hecho) {
        a3.hecho = 1; musica.sfx.aleteo(); sacude(0.1);
        const n = 12 + f * 2;
        for (let i = 0; i < n; i++) escamas.push(nuevaEscama(12 + ((i + Math.random()) / n) * (W - 24), azar(118, 212), 0, 13, { jefe: true, polvo: true, espera: 0.8 }));
      }
      if (a3.t > 1) jefe.ataque = null;
    }
  }

  /* El Faro. BALIZAS: suelta dos boyas que se quedan sobre el agua, cada
     una con un haz corto que gira; hay que pasar cuando mira para otro lado
     (un casco le hace sombra, y tres tiros la apagan). GIRO ENTERO: el haz
     barre la pantalla de punta a punta, como un faro de verdad, pero
     parpadea: se cruza en el parpadeo, o debajo de un casco. */
  const LARGO_BALIZA = 72;
  function enBaliza(z) {
    const dx = F.x - z.x, dy = M.Y_FANAL - 3 - z.y, ux = Math.sin(z.a), uy = Math.cos(z.a), a = dx * ux + dy * uy;
    if (a < 5 || a > LARGO_BALIZA || Math.abs(dx * uy - dy * ux) > 3.5) return false;
    for (let i = 1; i < 12; i++) if (naufragioEn(z.x + dx * i / 12, z.y + dy * i / 12)) return false;   // un casco da sombra
    return true;
  }
  function espFaro(dt, a2, a3, f) {
    const bz = jefe.balizas || (jefe.balizas = []);
    if (a2) {
      if (a2.t > 0.5 && !a2.hecho) {
        a2.hecho = 1; musica.sfx.ancla();
        // Una por lado, nunca dos encimadas.
        for (const s of [-1, 1]) if (!bz.some(z => z.tx < W / 2 === s < 0)) bz.push({ x: jefe.x, y: jefe.y + 8, tx: clamp(W / 2 + s * azar(42, 54), 16, W - 16), ty: 238, a: s * 1.9, w: s * (1.45 + f * 0.2), vida: 3, t: 0, dur: 11 });
      }
      if (a2.t > 0.9) jefe.ataque = null;
    }
    for (let i = bz.length - 1; i >= 0; i--) {
      const z = bz[i], k = 1 - Math.exp(-dt * 3.5);
      z.t += dt; z.a += z.w * dt;
      z.x += (z.tx - z.x) * k; z.y += (z.ty - z.y) * k;
      if (z.t > z.dur) { chispas(z.x, z.y, 8, ["#b4542c", "#ffd884"], 30, 0.5); bz.splice(i, 1); continue; }
      if (z.t >= 1.4 && estado === "juego" && enBaliza(z)) golpeFanal("baliza");   // antes de eso gira apagada: se ve venir
    }
    if (a3) {
      if (a3.a0 == null) { const s = F.x < W / 2 ? 1 : -1; a3.a0 = 0.58 * s; a3.a1 = -0.58 * s; a3.dur = 4.4 - f * 0.3; }   // empieza del lado de enfrente
      const tt = a3.t - 1.1;
      if (tt < 0) jefe.haz = { angs: [a3.a0], fin: [a3.a1], aviso: true };
      else if (tt < a3.dur) {
        const ang = lerp(a3.a0, a3.a1, tt / a3.dur), apagado = tt % 1.3 > 0.82;
        jefe.haz = { angs: [ang], aviso: false, apagado, giro: true };
        if (!a3.sono) { a3.sono = 1; musica.sfx.barrido(a3.dur); }
        if (!apagado && enHaz(ang)) golpeFanal("haz");
      } else jefe.ataque = null;
    }
  }

  /* La Esfinge. ESPEJISMO: se vuelve tres. Las tres disparan, pero solo a
     la verdadera se le encienden las marcas un instante antes; tirarle a
     una falsa la deshace y te devuelve el tiro, y acertar a la verdadera
     termina el engaño. LABERINTO: su acertijo, en serie: una fila de muro
     tras otra con el hueco corrido, un pasillo que baja torcido y hay que
     seguir. */
  function finEspejismo(acierto) {
    for (const e of jefe.espejos || []) if (e.viva) chispas(e.x, e.y, 14, ["#2a1e30", "#6a4a7a", "#d8cdb8"], 40, 0.7, "polvo");
    jefe.espejos = null; jefe.ataque = null; jefe.alfa = 1; jefe.oculta = false;
    if (acierto) { jefe.cd = Math.max(jefe.cd, 1.6); avisa("Era esa"); musica.sfx.ui(5); }
  }
  function espEsfinge(dt, a2, a3, f) {
    if (a2) {
      if (!a2.etapa) { a2.etapa = "huye"; a2.tt = 0; }
      a2.tt += dt;
      if (a2.etapa === "huye") {
        jefe.oculta = true; jefe.alfa = Math.max(0, 1 - a2.tt / 0.4);
        if (a2.tt > 0.4) {
          const sitios = [44, 120, 196].sort(() => Math.random() - 0.5);
          jefe.x = sitios[0]; jefe.y = jefe.casaY;
          jefe.espejos = [sitios[1], sitios[2]].map(x => ({ x, y: jefe.casaY, viva: true }));
          a2.etapa = "ronda"; a2.tt = 0; a2.tiro = 1.3; musica.sfx.eclipse();
        }
      } else {
        jefe.oculta = false; jefe.alfa = Math.min(1, a2.tt / 0.4);
        a2.tiro -= dt;
        if (a2.tiro < 0.4) jefe.marcas = 1;                              // lo que la delata
        if (a2.tiro <= 0) {
          a2.tiro = 1.6 - f * 0.15;
          for (const c of [jefe].concat(jefe.espejos.filter(e => e.viva))) escamas.push(nuevaEscama(c.x, c.y + 10, clamp((F.x - c.x) * 0.3, -34, 34), 78, { jefe: true, estilo: 3 }));
          musica.sfx.roce(jefe.x);
        }
        if (a2.tt > 6.5 || !jefe.espejos.some(e => e.viva)) finEspejismo(false);
      }
    }
    if (a3) {
      if (a3.g == null) { a3.filas = 6 + f; a3.k = 0; a3.g = clamp(Math.round(F.x / 12) - 1, 1, 17); a3.dir = Math.random() < 0.5 ? 1 : -1; }
      jefe.marcas = 1;
      jefe.pista = a3.k < a3.filas ? a3.g * 12 + 12 : null;              // el hueco de la fila que viene
      const tFila = 0.9 + a3.k * 0.5;
      if (a3.t > tFila && a3.k < a3.filas) {
        // Veinte bloques por fila; el hueco son dos, y se corre uno por fila.
        for (let i = 0; i < 20; i++) if (i < a3.g || i > a3.g + 1) escamas.push(nuevaEscama(i * 12 + 6, 40, 0, 42, { muro: true, ancho: true, jefe: true, estilo: 3 }));
        if (a3.k++ === 0) musica.sfx.eclipse(); else musica.sfx.roce(a3.g * 12);
        if (a3.g + a3.dir < 1 || a3.g + a3.dir > 17 || Math.random() < 0.22) a3.dir *= -1;
        a3.g = clamp(a3.g + a3.dir, 1, 17);
      }
      if (a3.k >= a3.filas && a3.t > tFila + 0.4) { jefe.pista = null; jefe.ataque = null; }
    }
  }

  /* El Casco. CADENA: el ancla cae a tu lado y se queda clavada; su cadena
     parte el agua en dos y no se cruza hasta que la sube. FUEGO FATUO: su
     llama se suelta del farol y sale a buscarte. Sin ella el casco es solo
     madera (no siente los tiros): hay que apagarla en el aire, tres tiros,
     para que vuelva. */
  function espCasco(dt, a2, a3, f) {
    if (a2) {
      if (a2.x == null) { const lado = F.x < W / 2 ? 1 : -1; a2.x = clamp(F.x + lado * azar(28, 44), 46, W - 46); }
      jefe.marcaX = a2.x;
      if (a2.t > 0.9 && !a2.suelta) { a2.suelta = 1; anclas.push({ x: a2.x, y: jefe.y + 16, vy: 0, sube: 0, t: 0, queda: 5 + f * 0.8 }); musica.sfx.ancla(); sacude(0.15); }
      if (a2.t > 1.7) { jefe.marcaX = null; jefe.ataque = null; }
    }
    if (a3) {
      if (a3.t > 0.7 && !a3.hecho) {
        a3.hecho = 1;
        if (!jefe.fatuo) { jefe.fatuo = { x: jefe.x, y: jefe.y + 10 * escalaJefe(), vida: 3, t: 0 }; jefe.sinLlama = true; musica.sfx.eclipse(); }
      }
      if (a3.t > 1.1) jefe.ataque = null;
    }
    const w = jefe.fatuo;
    if (!w) return;
    w.t += dt;
    const cx = jefe.x, cy = jefe.y + 10 * escalaJefe();
    if (w.vuelve) {
      const k = 1 - Math.exp(-dt * 7);
      w.x += (cx - w.x) * k; w.y += (cy - w.y) * k;
      if (Math.hypot(cx - w.x, cy - w.y) < 3) { jefe.fatuo = null; jefe.sinLlama = false; anillo(cx, cy, "#a8c8ff", 12); }
      return;
    }
    const tx = F.x, ty = M.Y_FANAL - 5, d = Math.hypot(tx - w.x, ty - w.y) || 1, v = w.t < 0.9 ? 10 : 50 + f * 6;   // primero duda, después viene
    w.x += ((tx - w.x) / d) * v * dt + Math.sin(w.t * 5) * 10 * dt; w.y += ((ty - w.y) / d) * v * dt;
    if (estado === "juego" && d < 8) { golpeFanal("fatuo"); w.vuelve = true; }
    else if (w.t > 11) w.vuelve = true;
  }

  /* La Crisálida. CAPULLO DE SEDA: se vuelve a envolver. La seda se come
     los tiros capa por capa (un tiro afinado corta tres), y hasta que no
     quede ninguna no siente nada. TELAR: teje una red de lado a lado que
     baja despacio. Los tiros la cortan; si te alcanza entera donde estás,
     te envuelve: remos enredados y la mecha mojada un rato. */
  function espCrisalida(dt, a2, a3, f) {
    if (a2) {
      if (a2.t > 0.9 && !a2.hecho) { a2.hecho = 1; jefe.seda = jefe.sedaMax = 9 + f * 3; anillo(jefe.x, jefe.y, "#f2ece2", 26); musica.sfx.barrido(0.5); }
      if (a2.t > 1.2) jefe.ataque = null;
    }
    jefe.redAviso = null;
    if (a3) {
      if (!a3.hecho) jefe.redAviso = jefe.y + 34;
      if (a3.t > 0.9 && !a3.hecho) { a3.hecho = 1; jefe.red = { y: jefe.y + 34, segs: new Array(20).fill(true), vy: 24 + f * 3 }; musica.sfx.barrido(0.6); }
      if (a3.t > 1.2) jefe.ataque = null;
    }
    const r = jefe.red;
    if (!r) return;
    r.y += r.vy * dt;
    if (r.y < M.Y_FANAL - 9) return;
    const i0 = clamp(Math.floor((F.x - 5) / 12), 0, 19), i1 = clamp(Math.floor((F.x + 5) / 12), 0, 19);
    if (estado === "juego" && !F.apagado && (r.segs[i0] || r.segs[i1])) {
      F.enredo = 3; F.mudo = 2.6; avisa("La red te envolvió");
      chispas(F.x, M.Y_FANAL - 6, 16, ["#f2ece2", "#ffffff"], 40, 0.7, "polvo"); musica.sfx.roce(F.x); sacude(0.2);
    }
    jefe.red = null;
  }

  /* La Hoguera. TIZONES: marca el agua y deja caer leños encendidos que
     siguen ardiendo ahí un rato: por un tiempo, ese pedazo de agua no se
     pisa. HONDA: arranca uno de los fanales que tiene presos y te lo
     arroja. Si le aciertas en el aire queda libre y rema contigo; si no,
     revienta en ascuas donde cae y vuelve a su sitio. */
  /* Dónde está un fanal preso: en su órbita, o en el aire si lo arrojó. */
  function posPreso(o) {
    if (o.lanz && o.lanz.x != null) return { x: o.lanz.x, y: o.lanz.y };
    return { x: jefe.x + Math.cos(o.a) * o.r, y: jefe.y + Math.sin(o.a) * o.r * 0.7 };
  }
  function espHoguera(dt, a2, a3, f) {
    const ch = jefe.charcos || (jefe.charcos = []);
    for (let i = ch.length - 1; i >= 0; i--) {
      const c = ch[i];
      c.t -= dt;
      if (c.t <= 0) { ch.splice(i, 1); continue; }
      if (estado === "juego" && c.t < c.dur - 0.25 && Math.abs(F.x - c.x) < 8) golpeFanal("tizon");
    }
    for (const o of jefe.orbita) if (o.lanz) {
      const l = o.lanz, casa = { x: jefe.x + Math.cos(o.a) * o.r, y: jefe.y + Math.sin(o.a) * o.r * 0.7 };
      if (!o.viva) { o.lanz = null; continue; }                          // le acertaron: ya es libre
      l.t += dt;
      if (l.etapa === "carga") {
        l.x = casa.x + Math.sin(l.t * 40) * 1.5; l.y = casa.y;
        if (l.t > 0.7) { l.etapa = "vuela"; l.t = 0; l.x0 = casa.x; l.y0 = casa.y; l.tx = clamp(F.x, 10, W - 10); musica.sfx.picada(); }
      } else if (l.etapa === "vuela") {
        const k = Math.min(1, l.t / 1.15);
        l.x = lerp(l.x0, l.tx, k); l.y = lerp(l.y0, M.Y_FANAL - 5, k * k);   // cae acelerando
        if (k >= 1) {
          if (estado === "juego" && Math.abs(l.tx - F.x) < 9) golpeFanal("fanal");
          for (let i = 0; i < 5; i++) escamas.push(nuevaEscama(l.tx, M.Y_FANAL - 12, azar(-62, 62), azar(-125, -75), { ascua: true, g: 75, jefe: true, estilo: 8 }));
          chispas(l.tx, M.Y_FANAL - 6, 14, ["#ffd070", "#ff6a20"], 60, 0.6); musica.sfx.escudo(); sacude(0.15);
          l.etapa = "vuelve"; l.t = 0;
        }
      } else {
        const k = Math.min(1, l.t / 0.9);
        l.x = lerp(l.tx, casa.x, suave(k)); l.y = lerp(M.Y_FANAL - 5, casa.y, suave(k));
        if (k >= 1) o.lanz = null;
      }
    }
    jefe.tizones = null;
    if (a2) {
      if (!a2.xs) {
        a2.xs = [clamp(F.x + azar(-8, 8), 12, W - 12)];
        for (let g = 0; a2.xs.length < 3 + f && g < 60; g++) { const x = azar(14, W - 14); if (a2.xs.every(y => Math.abs(y - x) > 34)) a2.xs.push(x); }
      }
      if (a2.t < 1) jefe.tizones = a2.xs;                                 // la marca en el agua
      else if (!a2.hecho) {
        a2.hecho = 1; musica.sfx.llamarada(0.5); sacude(0.12);
        for (const x of a2.xs) escamas.push(nuevaEscama(x, jefe.y + 20, 0, 200, { jefe: true, tizon: true, grande: true, estilo: 8 }));
      }
      if (a2.t > 1.4) jefe.ataque = null;
    }
    if (a3) {
      if (!a3.lista) {
        const presos = jefe.orbita.filter(o => o.viva && !o.lanz);
        // Si ya los soltaste a todos no tiene qué arrojar: tira tizones.
        if (!presos.length) { jefe.ataque = { nombre: "esp2", t: 0, hecho: 0 }; avisa("✦ " + habilidad(2)); return; }
        a3.lista = presos.sort(() => Math.random() - 0.5).slice(0, 1 + f); a3.k = 0;
      }
      const tSig = 0.4 + a3.k * 1.0;
      if (a3.k < a3.lista.length && a3.t > tSig) { const o = a3.lista[a3.k++]; if (o.viva && !o.lanz) o.lanz = { t: 0, etapa: "carga" }; musica.sfx.aviso(); }
      else if (a3.k >= a3.lista.length && a3.t > tSig + 0.3) jefe.ataque = null;
    }
  }

  /* La Luna. LUNA LLENA: se llena y hace de espejo: mientras brilla
     entera, cada tiro que la toca vuelve hacia ti (lo que el Alba ya
     enseñó). Hay que soltar el gatillo. RESACA DE LUZ: sube la marea, y lo
     que cae al agua no se va: vuelve hacia arriba un momento después, por
     donde cayó. Cada escama se esquiva dos veces. */
  function espLuna(dt, a2, a3, f) {
    jefe.llena = Math.max(0, (jefe.llena || 0) - dt * 2.5);
    jefe.espejo = false; jefe.resacaAviso = false;
    if (a2) {
      const dur = 3.4 + f * 0.4;
      if (a2.t < 0.9) jefe.llena = a2.t / 0.9;
      else if (a2.t < 0.9 + dur) {
        jefe.llena = 1; jefe.espejo = true;
        if (!a2.sono) { a2.sono = 1; musica.sfx.eclipse(); anillo(jefe.x, jefe.y, "#fff8e8", 30); }
        F.viento = Math.sin((a2.t - 0.9) * 2.4) * (80 + f * 20);          // y mientras, tira de la marea
        a2.acum = (a2.acum || 0) + dt;
        if (a2.acum > 0.45) { a2.acum = 0; escamas.push(nuevaEscama(azar(12, W - 12), 30, 0, azar(46, 60), { jefe: true, estilo: 9 })); }
      } else jefe.ataque = null;
    }
    if (a3) {
      if (!a3.hecho) jefe.resacaAviso = true;
      if (a3.t > 0.9 && !a3.hecho) {
        a3.hecho = 1; jefe.resaca = 6.5 + f; musica.sfx.barrido(1.2);
        for (let i = 0; i < 7 + f * 2; i++) escamas.push(nuevaEscama(azar(12, W - 12), azar(20, 40), 0, azar(60, 84), { jefe: true, estilo: 9 }));
      }
      if (a3.t > 1.2) jefe.ataque = null;
    }
    if (jefe.resaca > 0) jefe.resaca -= dt;
  }

  /* Las Siete Hermanas. ALINEACIÓN: dejan su figura, se ponen en fila de
     lado a lado y cada una baja un rayo fino; entre rayo y rayo hay un
     pasillo. Vuelven a tirar corridas media hermana. SUPERNOVA: una se
     enciende de rojo y empieza a contar. Hay que acertarle unas cuantas
     veces antes de que estalle en todas direcciones. */
  const xLinea = i => 24 + i * 32;
  function espConstelacion(dt, a2, a3, f) {
    let fila = 0;
    if (a2) {
      const tt = a2.t - 0.8, k = Math.floor(tt / 1.5), u = tt - k * 1.5;
      if (tt >= 0) {
        if (k > f) { columnas = []; jefe.ataque = null; }
        else {
          jefe.corre = (k % 2) * 16;
          const xs = jefe.hermanas.map((_, i) => xLinea(i) + jefe.corre);
          if (u < 0.75) columnas = xs.map(x => ({ x, aviso: true, fino: true }));
          else if (u < 1.35) {
            columnas = xs.map(x => ({ x, aviso: false, fino: true }));
            if (a2.sono !== k) { a2.sono = k; musica.sfx.llamarada(0.5); sacude(0.1); }
            if (estado === "juego" && xs.some(x => Math.abs(x - F.x) < 4.5) && !naufragioEn(F.x, M.Y_NAUFRAGIOS + 2)) golpeFanal("alineacion");
          } else columnas = [];
        }
      }
      if (jefe.ataque) fila = 1;
    }
    jefe.fila = (jefe.fila || 0) + (fila - (jefe.fila || 0)) * (1 - Math.exp(-dt * 5));
    if (a3) {
      if (a3.t > 0.5 && !a3.hecho) {
        a3.hecho = 1;
        const cand = jefe.hermanas.filter(h => !h.velada && !h.nova);
        if (cand.length) { cand[entero(0, cand.length - 1)].nova = { t: 0, dur: 4.2 - f * 0.4, golpes: 0, pide: 4 + f }; musica.sfx.aviso(); }
      }
      if (a3.t > 0.9) jefe.ataque = null;
    }
    for (const h of jefe.hermanas) if (h.nova) {
      const v = h.nova;
      v.t += dt; h.velada = false;                                        // la que va a estallar no se esconde
      if (v.t < v.dur) continue;
      const p = posHermana(h), n = 18 + f * 2;
      for (let i = 0; i < n; i++) { const ang = (i / n) * Math.PI * 2; escamas.push(nuevaEscama(p.x, p.y, Math.sin(ang) * 62, Math.cos(ang) * 62, { jefe: true, estilo: 10 })); }
      relampago("#fff0c8", 0.35); sacude(0.3); destella(p.x, p.y, 50, 1, 0.5); musica.sfx.empuje();
      h.nova = null; h.velada = true;
    }
  }

  /* El Sol. CANÍCULA: el aire arde. Mientras dura, quedarse quieto
     calienta el vidrio (se ve en el fanal) y, si se llena, cruje: una
     llama. Remar lo enfría, y la sombra de un casco más. COLAPSO: se cierra
     sobre sí mismo. Mientras se achica tira de todo —de las escamas, que
     se traga, y de la barca, que arrastra bajo él— y después estalla en
     dos coronas seguidas. */
  function espSol(dt, a2, a3, f) {
    jefe.colapso = 1; jefe.caniculaAviso = false;
    if (a2) {
      if (!a2.hecho) jefe.caniculaAviso = true;
      if (a2.t > 1 && !a2.hecho) { a2.hecho = 1; jefe.canicula = 6 + f; musica.sfx.llamarada(1); }
      if (a2.t > 1.2) jefe.ataque = null;
    }
    if (jefe.canicula > 0) {
      jefe.canicula -= dt;
      const sombra = !!naufragioEn(F.x, M.Y_NAUFRAGIOS + 2), quieto = Math.abs(F.vx) < 28;
      F.calor = clamp(F.calor + dt * (sombra ? -1.6 : quieto ? 0.6 : -0.9), 0, 1);
      if (F.calor >= 1 && estado === "juego") { F.calor = 0; golpeFanal("calor"); }
    } else if (!jefe.amanecer && !jefe.lupa) F.calor = Math.max(0, F.calor - dt * 1.5);   // el Amanecer (5) y la Lupa (6) llevan su propio calor
    if (a3) {
      const t = a3.t;
      if (t < 0.5) { if (!a3.sono) { a3.sono = 1; anillo(jefe.x, jefe.y, "#fff6d8", 40 * escalaJefe()); } }
      else if (t < 3) {
        jefe.colapso = lerp(1, 0.4, suave(Math.min(1, (t - 0.5) / 1.2)));
        F.viento = clamp((jefe.x - F.x) / 20, -1, 1) * (120 + f * 25);
        for (let i = escamas.length - 1; i >= 0; i--) {
          const e = escamas[i];
          if (e.muro || e.devuelta) continue;
          const dx = jefe.x - e.x, dy = jefe.y - e.y, d = Math.hypot(dx, dy) || 1;
          e.vx += (dx / d) * 260 * dt; e.vy += (dy / d) * 260 * dt; e.g = 0;
          if (d < 16) escamas.splice(i, 1);
        }
        if (Math.random() < 0.7) { const a = Math.random() * 6.28, r = azar(60, 120); particulas.push({ x: jefe.x + Math.cos(a) * r, y: jefe.y + Math.sin(a) * r, vx: -Math.cos(a) * 150, vy: -Math.sin(a) * 150, vida: 0.5, max: 0.5, col: "#ffd070", tipo: "viento" }); }
      } else if (!a3.hecho) {
        a3.hecho = 1; relampago("#fff6d8", 0.5); sacude(0.4); musica.sfx.empuje();
        corona(f, 0, 82);
      } else {
        if (t > 3.45 && !a3.r2) { a3.r2 = 1; corona(f, 0.5, 60); }
        if (t > 3.9) jefe.ataque = null;
      }
    }
  }
  /* ================================================================
     La fase 4 (desde la tercera vuelta del sin fin)
     ================================================================
     «La ascendida» (el modelo, en sprites.js: el cuerpo es cielo y sus
     señas, estrellas). Cada jefe conserva sus dos habilidades y estrena
     una tercera; las tres rotan, empezando por la nueva.

       Nodriza         Reclamo      un bloque de polillas que baja marchando
       Faro            Deslumbre    luz en todo menos en dos franjas de sombra
       Esfinge         Tu sombra    cada tiro tuyo te lo contesta tu reflejo
       Casco           Bala rasa    balas que cruzan saltando sobre el agua
       Crisálida       Mortaja      un capullo para ti: se corta a tiros
       Hoguera         Cerco        el fuego entra desde las dos orillas
       Luna            Horizonte    los bordes se unen: la barca da la vuelta
       Siete Hermanas  Ronda        bajan a rodearte y tiran de a una
       Sol             Ocaso        baja sobre ti: se sostiene a tiros

     Como las otras, no tocan la prueba: las polillas del Reclamo son
     larvas (O, que la Nodriza ya tenía), el Ocaso se sostiene con golpes
     al Sol (X, los de siempre), y la seda de la Mortaja se corta con tiros
     que no llegan a salir: se anotan como disparos y no dan nada. */
  const Y_AGUA = M.Y_FANAL + 3;

  /* La Nodriza. RECLAMO: llama a las suyas y vienen como las de antes: un
     bloque que marcha de lado, baja un poco a cada paso y más rápido
     cuantas menos quedan. Las de abajo disparan; si llegan al agua rompen
     filas y se tiran a la luz. */
  function esp4Nodriza(dt, a4, f) {
    if (a4) {
      if (a4.t > 0.7 && !a4.hecho) {
        a4.hecho = 1;
        if (!jefe.reclamo) {
          musica.sfx.aleteo();
          const cols = 6, filas = 2 + (f === 2 ? 1 : 0), ancho = (cols - 1) * 14;
          jefe.reclamo = { x: clamp(jefe.x - ancho / 2, 14, W - 14 - ancho), y: jefe.y + 30 * escalaJefe(), dir: F.x > W / 2 ? 1 : -1, paso: 0.5, fuego: 1.5 };
          for (let r = 0; r < filas; r++) for (let c = 0; c < cols; c++) larvas.push({ x: jefe.x, y: jefe.y, bx: c * 14, by: r * 11, reclamo: true, vx: 0, vy: 0, t: 0, vida: 1, f: Math.random() * 6 });
        }
      }
      if (a4.t > 1.1) jefe.ataque = null;
    }
    const q = jefe.reclamo;
    if (!q) return;
    const suyas = larvas.filter(l => l.reclamo && l.vida > 0);
    if (!suyas.length) { jefe.reclamo = null; return; }
    q.paso -= dt; q.fuego -= dt;
    if (q.paso <= 0) {
      q.paso = 0.13 + 0.018 * suyas.length;
      const min = Math.min(...suyas.map(l => l.bx)), max = Math.max(...suyas.map(l => l.bx));
      if (q.x + max + 9 * q.dir > W - 10 || q.x + min + 9 * q.dir < 10) q.dir *= -1; else q.x += 9 * q.dir;
      q.y += 3;
    }
    if (q.fuego <= 0 && estado === "juego") {
      q.fuego = 1.25 - f * 0.15;
      const l = suyas[Math.floor(Math.random() * suyas.length)], abajo = suyas.filter(o => o.bx === l.bx).sort((a, b) => b.by - a.by)[0];
      escamas.push(nuevaEscama(q.x + abajo.bx, q.y + abajo.by + 4, 0, 78, { jefe: true, estilo: 3 }));
    }
    if (q.y + Math.max(...suyas.map(l => l.by)) > 222) {
      for (const l of suyas) { l.reclamo = false; l.t = 0.7; l.vx = azar(-20, 20); l.vy = 10; }
      jefe.reclamo = null;
    }
  }

  /* El Faro. DESLUMBRE: la lente se carga y lo alumbra todo de golpe. Antes
     de eso se ven dos franjas de sombra (las que dan sus brazos): hay que
     estar en una, o debajo de un casco, cuando estalla. La luz se lleva
     también las escamas que no estaban a la sombra. */
  function esp4Faro(dt, a4, f) {
    jefe.deslumbre = null;
    if (!a4) return;
    const carga = 1.9;
    if (!a4.s) { a4.s = [azar(26, 96), azar(144, 214)]; a4.w = 15 - f * 2; musica.sfx.barrido(carga); }
    jefe.haz = null;
    jefe.deslumbre = { s: a4.s, w: a4.w, q: Math.min(1, a4.t / carga), pum: a4.t >= carga };
    if (a4.t >= carga && !a4.hecho) {
      a4.hecho = 1; relampago("#f2fbe6", 0.9); sacude(0.3); musica.sfx.empuje();
      const aSalvo = x => a4.s.some(s => Math.abs(x - s) < a4.w) || !!naufragioEn(x, M.Y_NAUFRAGIOS + 2);
      if (estado === "juego" && !aSalvo(F.x)) golpeFanal("deslumbre");
      escamas = escamas.filter(e => e && (e.muro || !e.jefe || aSalvo(e.x)));
    }
    if (a4.t > carga + 0.5) jefe.ataque = null;
  }

  /* La Esfinge. TU SOMBRA: pone arriba una barca como la tuya, a oscuras y
     del otro lado del espejo (si vas a la izquierda, ella a la derecha).
     Cada tiro tuyo, ella lo contesta hacia abajo desde donde está: en el
     medio te tiras a ti mismo, y para cruzar de lado hay que dejar de
     disparar. La respuesta es el acertijo. */
  function esp4Esfinge(dt, a4, f) {
    if (a4) {
      if (!a4.hecho) { a4.hecho = 1; jefe.sombra = { x: W - F.x, y: 118, t: 0, dur: 7.5 + f, cola: [] }; musica.sfx.eclipse(); }
      if (a4.t > 1) jefe.ataque = null;
    }
    const s = jefe.sombra;
    if (!s) return;
    s.t += dt;
    s.x = lerp(s.x, W - F.x, 1 - Math.exp(-dt * 9));
    for (let i = s.cola.length - 1; i >= 0; i--) if ((s.cola[i] -= dt) <= 0) {
      s.cola.splice(i, 1);
      if (estado === "juego") { escamas.push(nuevaEscama(s.x, s.y + 6, 0, 165, { jefe: true, estilo: 3 })); musica.sfx.roce(s.x); }
    }
    if (s.t > s.dur) { chispas(s.x, s.y, 12, ["#2a1e30", "#6a4a7a", "#b48cff"], 40, 0.6, "polvo"); jefe.sombra = null; }
  }

  /* El Casco. BALA RASA: dispara balas que no caen: rebotan en el agua como
     una piedra chata y cruzan saltando hasta la otra orilla, donde rebotan
     una vez y vuelven. Cada salto marca dónde va a caer: se pasa por
     debajo mientras va alta. Los cascos hundidos no la paran (los rompe). */
  function caeEn(b) {
    const g = 380, t = (-b.vy + Math.sqrt(Math.max(0, b.vy * b.vy + 2 * g * (Y_AGUA - b.y)))) / g;
    return b.x + b.vx * t;
  }
  function esp4Casco(dt, a4, f) {
    const bs = jefe.balasR || (jefe.balasR = []);
    if (a4) {
      const n = 1 + (f > 0 ? 1 : 0);
      a4.k = a4.k || 0;
      if (a4.k < n && a4.t > 0.7 + a4.k * 1) {
        a4.k++; musica.sfx.ancla(); sacude(0.12);
        // La primera caída es cerca de ti; de ahí salta hacia la orilla de enfrente.
        const b = { x: jefe.x, y: jefe.y + 12, vx: 0, vy: -70, pared: 1, r: 0 }, tx = clamp(F.x + azar(-26, 26), 14, W - 14);
        b.vx = 1; b.vx = (tx - b.x) / ((caeEn(b) - b.x) || 1);
        b.dir = tx < W / 2 ? 1 : -1; b.cae = tx;
        bs.push(b);
      }
      if (a4.k >= n && a4.t > 0.9 + n) jefe.ataque = null;
    }
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i];
      b.vy += 380 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.r += dt * 9;
      if (b.y >= Y_AGUA && b.vy > 0) {
        b.y = Y_AGUA; b.vy = -208; b.vx = b.dir * (60 + f * 5);
        chispas(b.x, Y_AGUA, 8, ["#c8d8f0", "#8fd8ff"], 40, 0.4); musica.sfx.roce(b.x);
        b.cae = caeEn(b);
      }
      if ((b.x < 6 && b.vx < 0) || (b.x > W - 6 && b.vx > 0)) {
        if (b.pared-- <= 0) { bs.splice(i, 1); continue; }
        b.vx *= -1; b.dir *= -1; b.cae = caeEn(b);
      }
      const hit = naufragioEn(b.x, b.y);
      if (hit) erosiona(hit.n, hit.lx, hit.ly, 3);
      if (estado === "juego" && Math.abs(b.x - F.x) < 7 && Math.abs(b.y - (M.Y_FANAL - 3)) < 7) golpeFanal("bala");
    }
  }

  /* La Crisálida. MORTAJA: un capullo baja sobre ti. La marca te sigue un
     momento y después se queda quieta: ahí cae. Si te alcanza, quedas
     envuelto: la barca no se mueve y los tiros no salen, cortan seda (uno
     afinado corta tres vueltas). Hay que salir antes de que se cierre. */
  function cortaMortaja(afinado) {
    F.capullo -= afinado ? 3 : 1;
    chispas(F.x, M.Y_FANAL - 6, 6, ["#f2ece2", "#ffffff"], 34, 0.4, "polvo"); musica.sfx.escudo();
    if (F.capullo <= 0) { F.capullo = 0; anillo(F.x, M.Y_FANAL - 4, "#f2ece2", 22); musica.sfx.empuje(); }
  }
  function esp4Crisalida(dt, a4, f) {
    jefe.mortaja = null;
    if (a4) {
      if (a4.t < 0.95 || a4.x == null) a4.x = F.x;
      jefe.mortaja = { x: a4.x, q: Math.min(1, a4.t / 1.35), fija: a4.t >= 0.95 };
      if (a4.t >= 1.35 && !a4.hecho) {
        a4.hecho = 1;
        if (estado === "juego" && Math.abs(F.x - a4.x) < 12 && !F.apagado) { F.capullo = 7 + f * 2; F.capX = F.x; F.capT = 2.4; musica.sfx.barrido(0.4); avisa("¡Corta la seda!"); }
        else chispas(a4.x, M.Y_FANAL - 4, 10, ["#f2ece2", "#c8bcb0"], 30, 0.5, "polvo");
      }
      if (a4.t > 1.6) jefe.ataque = null;
    }
    if (F.capullo > 0) {
      F.capT -= dt;
      if (F.capT <= 0) { F.capullo = 0; if (estado === "juego") golpeFanal("mortaja"); }
    }
  }

  /* La Hoguera. CERCO: el fuego entra por el agua desde las dos orillas y
     deja una franja sola, marcada de antemano alrededor de donde estabas.
     Mientras dura, todo lo demás hay que esquivarlo ahí adentro. */
  function esp4Hoguera(dt, a4, f) {
    if (a4) {
      if (!a4.hecho) { a4.hecho = 1; jefe.cerco = { c: clamp(F.x, 62, W - 62), w: 44 - f * 5, t: 0, dur: 7 + f, izq: 0, der: W }; musica.sfx.llamarada(1); }
      if (a4.t > 1) jefe.ataque = null;
    }
    const c = jefe.cerco;
    if (!c) return;
    c.t += dt;
    const k = Math.min(suave(clamp((c.t - 0.9) / 1.5, 0, 1)), suave(clamp((c.dur - c.t) / 0.8, 0, 1)));
    c.izq = (c.c - c.w) * k; c.der = W - (W - (c.c + c.w)) * k;
    if (estado === "juego" && k > 0.02 && (F.x < c.izq + 5 || F.x > c.der - 5)) {
      golpeFanal("cerco");
      F.x = clamp(F.x, c.izq + 9, c.der - 9); F.vx = 0;                 // el fuego te echa hacia adentro
    }
    if (c.t > c.dur) jefe.cerco = null;
  }

  /* La Luna. HORIZONTE: el mar da la vuelta: las dos orillas son la misma
     y la barca que sale por un borde entra por el otro. Mientras dura
     manda muros de marea de lado a lado, con un solo paso: una vez en la
     costura (los bordes) y otra en el medio. */
  function esp4Luna(dt, a4, f) {
    jefe.horizonteAviso = false;
    if (a4) {
      if (!a4.hecho) jefe.horizonteAviso = true;
      if (a4.t > 1 && !a4.hecho) { a4.hecho = 1; jefe.horizonte = 7.5 + f; jefe.hzT = 0.4; jefe.hzK = 0; musica.sfx.barrido(1); }
      if (a4.t > 1.2) jefe.ataque = null;
    }
    if (!(jefe.horizonte > 0)) return;
    jefe.horizonte -= dt; jefe.hzT -= dt;
    if (jefe.hzT <= 0 && jefe.horizonte > 2.2) {
      jefe.hzT = 2.3 - f * 0.2;
      const costura = jefe.hzK++ % 2 === 0;
      for (let i = 0; i < 20; i++) if (costura ? i > 1 && i < 18 : i < 8 || i > 11) escamas.push(nuevaEscama(i * 12 + 6, 44, 0, 58, { muro: true, ancho: true, jefe: true, estilo: 9 }));
      musica.sfx.roce(costura ? 4 : W / 2);
    }
  }

  /* Las Siete Hermanas. RONDA: bajan y te rodean en media luna (la ronda
     te sigue, despacio). De a una, en desorden, se encienden, marcan la
     línea hacia donde estás y tiran por ella. Están cerca: es cuando más
     fácil es darles. */
  function posRonda(i) {
    const a = Math.PI * (1.15 + 0.7 * (i + 0.5) / 7) + Math.sin(jefe.t * 0.7) * 0.08, R = 84;
    return { x: clamp(jefe.rondaX + Math.cos(a) * R, 8, W - 8), y: M.Y_FANAL - 8 + Math.sin(a) * R * 0.95 };
  }
  function esp4Constelacion(dt, a4, f) {
    if (a4 && !a4.orden) { a4.orden = jefe.hermanas.map((_, i) => i).sort(() => Math.random() - 0.5); a4.k = 0; a4.tt = -1.3; jefe.rondaX = F.x; musica.sfx.barrido(1); }
    jefe.ronda = clamp((jefe.ronda || 0) + (a4 ? dt / 1.1 : -dt / 0.9), 0, 1);
    jefe.punta = null;
    if (!a4) return;
    jefe.rondaX = lerp(jefe.rondaX, F.x, 1 - Math.exp(-dt * 1.1));
    a4.tt += dt;
    const apunta = 0.5, cada = 0.78 - f * 0.07;
    if (a4.k < a4.orden.length && a4.tt >= 0) {
      const h = jefe.hermanas[a4.orden[a4.k]], p = posHermana(h);
      if (!a4.obj) { a4.obj = { x: F.x, y: M.Y_FANAL - 3 }; musica.sfx.aviso(); }
      jefe.punta = { i: a4.orden[a4.k], x: a4.obj.x, y: a4.obj.y, q: a4.tt / apunta };
      if (a4.tt >= apunta) {
        const dx = a4.obj.x - p.x, dy = a4.obj.y - p.y, d = Math.hypot(dx, dy) || 1;
        escamas.push(nuevaEscama(p.x, p.y, (dx / d) * 190, (dy / d) * 190, { jefe: true, estilo: 9 }));
        h.flash = 0.12; musica.sfx.roce(p.x);
        a4.k++; a4.obj = null; a4.tt -= cada;
      }
    }
    if (a4.k >= a4.orden.length && a4.tt > 0.1) jefe.ataque = null;
  }

  /* El Sol. OCASO: baja. Despacio, entero, hacia el agua. Cada golpe que
     recibe lo empuja un poco hacia arriba: hay que sostenerlo a tiros
     hasta que se canse. Si llega a la línea, quema (salvo bajo un casco)
     y suelta una corona antes de volver a subir. */
  function esp4Sol(dt, a4, f) {
    if (a4 && !jefe.ocaso && !a4.hecho) { a4.hecho = 1; jefe.ocaso = { t: 0, baja: 0, empuje: 0, etapa: "aviso" }; musica.sfx.eclipse(); }
    const o = jefe.ocaso;
    if (!o) { if (a4 && a4.hecho) jefe.ataque = null; return; }
    jefe.y += o.baja;
    o.t += dt;
    const tope = M.Y_NAUFRAGIOS - 16 - 22 * escalaJefe() - jefe.casaY;
    if (o.etapa === "aviso") { o.empuje = 0; if (o.t > 0.9) { o.etapa = "baja"; o.t = 0; } }
    else if (o.etapa === "baja") {
      o.baja = Math.max(0, o.baja + (38 + f * 4) * dt - o.empuje); o.empuje = 0;
      if (o.baja >= tope) {
        o.baja = tope; o.etapa = "sube"; o.toco = true;
        relampago("#fff6d8", 0.6); sacude(0.6); musica.sfx.empuje();
        if (estado === "juego" && !naufragioEn(F.x, M.Y_NAUFRAGIOS + 2)) golpeFanal("ocaso");
        corona(f, 0, 78);
      } else if (o.t > 6.5) { o.etapa = "sube"; anillo(jefe.x, jefe.y, "#8fd8ff", 44); avisa("Lo sostuviste"); musica.sfx.ui(5); }
    } else {
      o.empuje = 0; o.baja -= 120 * dt;
      if (o.baja <= 0) { jefe.ocaso = null; jefe.cd = Math.max(jefe.cd, o.toco ? 0.6 : 1.8); if (a4) jefe.ataque = null; }
    }
  }
  const ESPECIALES4 = { nodriza: esp4Nodriza, faro: esp4Faro, esfinge: esp4Esfinge, casco: esp4Casco, crisalida: esp4Crisalida, hoguera: esp4Hoguera, luna: esp4Luna, constelacion: esp4Constelacion, sol: esp4Sol };

  /* Lo que las habilidades de la fase 4 ponen en pantalla (lo de la
     Mortaja sobre la barca está en dibujaFanal). */
  function dibujaFase4() {
    const t = jefe.tipo;
    if (t === "faro" && jefe.deslumbre) {
      const d = jefe.deslumbre;
      // La luz crece en todo menos en las dos franjas, que se marcan desde el principio.
      if (!d.pum) {
        lx.fillStyle = "#f2fbe6"; lx.globalAlpha = 0.05 + 0.3 * d.q * d.q;
        let x0 = 0;
        for (const s of d.s.slice().sort((a, b) => a - b).concat([W + d.w])) { lx.fillRect(Math.floor(x0), 30, Math.max(0, Math.floor(s - d.w - x0)), H - 30); x0 = s + d.w; }
        lx.globalAlpha = 1;
      }
      ex.fillStyle = "#c8f0ff";
      for (const s of d.s) {
        for (const b of [-1, 1]) for (let y = 96; y < H; y += 6) { ex.globalAlpha = 0.75; ex.fillRect(Math.floor(s + b * d.w), y, 1, 3); }
        ex.globalAlpha = 1; ex.fillRect(Math.floor(s - d.w), M.Y_FANAL + 6, Math.floor(d.w * 2), 1);
      }
      brillo(jefe.x, jefe.y + 2, 20 + 50 * d.q, "#f2fbe6", 0.5 + 0.5 * d.q);
    }
    if (t === "esfinge" && jefe.sombra) {
      const s = jefe.sombra, x = Math.floor(s.x), y = Math.floor(s.y), a = Math.min(1, s.t) * clamp((s.dur - s.t) / 0.6, 0, 1);
      ex.globalAlpha = a;
      // Tu barca, del revés y a oscuras: la llama le cuelga hacia abajo.
      ex.fillStyle = "#3a2a5c"; ex.fillRect(x - 7, y - 4, 15, 3); ex.fillRect(x - 5, y - 1, 11, 2); ex.fillRect(x - 3, y - 9, 7, 5);
      ex.fillStyle = "#b48cff"; ex.fillRect(x - 7, y - 5, 15, 1); ex.fillRect(x - 4, y - 10, 9, 1); ex.fillRect(x - 1, y + 1, 3, 3);
      ex.fillStyle = "#ffffff"; ex.fillRect(x, y + 2, 1, 2 + (Math.sin(tMusica * 15) > 0 ? 1 : 0));
      ex.globalAlpha = 1;
      brillo(s.x, s.y + 3, 9, "#b48cff", 0.5 * a);
      // El espejo (una línea en el medio) y por dónde caen sus tiros.
      lx.fillStyle = "#b48cff";
      for (let yy = 100; yy < H; yy += 7) { lx.globalAlpha = 0.25; lx.fillRect(W / 2, yy, 1, 3); }
      for (let yy = y + 10; yy < M.Y_FANAL + 4; yy += 9) { lx.globalAlpha = 0.2 * a; lx.fillRect(x, yy, 1, 2); }
      lx.globalAlpha = 1;
    }
    if (t === "casco") for (const b of jefe.balasR || []) {
      const x = Math.floor(b.x), y = Math.floor(b.y);
      ex.fillStyle = "#0c1434"; ex.fillRect(x - 3, y - 2, 7, 5); ex.fillRect(x - 2, y - 3, 5, 7);
      ex.fillStyle = "#8fd8ff"; ex.fillRect(x - 2, y - 2, 2, 2); ex.fillRect(x + (Math.floor(b.r) & 1 ? 1 : -1), y + 1, 1, 1);
      brillo(b.x, b.y, 8, "#8fd8ff", 0.5);
      // Dónde va a caer.
      if (b.cae > 4 && b.cae < W - 4) {
        const cx = Math.floor(b.cae);
        lx.fillStyle = "#c8f0ff"; lx.globalAlpha = Math.floor(tMusica * 10) & 1 ? 0.9 : 0.5;
        lx.fillRect(cx - 5, M.Y_FANAL + 5, 11, 1); lx.fillRect(cx - 2, M.Y_FANAL + 3, 5, 1); lx.fillRect(cx, M.Y_FANAL - 8, 1, 10);
        lx.globalAlpha = 1;
      }
    }
    if (t === "crisalida" && jefe.mortaja) {
      const m = jefe.mortaja, x = Math.floor(m.x), y = lerp(jefe.y + 30, M.Y_FANAL - 4, m.q * m.q);
      ex.fillStyle = "#f2ece2";
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + tMusica * 3; ex.fillRect(Math.floor(x + Math.cos(a) * 11), Math.floor(y + Math.sin(a) * 8), 2, 1); }
      lx.fillStyle = m.fija ? "#ffffff" : "#f2ece2"; lx.globalAlpha = m.fija ? 0.6 + 0.4 * Math.sin(tMusica * 30) : 0.5;
      lx.fillRect(x - 12, M.Y_FANAL + 6, 25, 1); lx.fillRect(x - 12, M.Y_FANAL + 2, 1, 4); lx.fillRect(x + 12, M.Y_FANAL + 2, 1, 4);
      lx.globalAlpha = 1;
    }
    if (t === "hoguera" && jefe.cerco) {
      const c = jefe.cerco, yA = M.Y_FANAL + 5, fc = jefe.fase >= 5 ? ["#a85c3c", "#ffb040", "#fff2c8"] : ["#3c50b4", "#8fd8ff", "#ffffff"];   // en la 5, el Cerco vuelve a ser fuego
      // Hasta dónde va a llegar, y el fuego (frío) que entra por las dos orillas.
      lx.fillStyle = "#c8f0ff";
      for (const x of [c.c - c.w, c.c + c.w]) for (let y = 216; y < H; y += 6) { lx.globalAlpha = 0.6; lx.fillRect(Math.floor(x), y, 1, 3); }
      lx.globalAlpha = 1;
      for (const [x0, x1] of [[0, c.izq], [c.der, W]]) for (let x = Math.floor(x0); x < x1; x += 3) {
        const h = 9 + Math.round(8 * Math.abs(Math.sin(x * 0.7 + tMusica * 9)));
        ex.fillStyle = fc[0]; ex.fillRect(x, yA - h, 3, h);
        ex.fillStyle = fc[1]; ex.fillRect(x, yA - Math.round(h * 0.6), 2, Math.round(h * 0.6));
        ex.fillStyle = fc[2]; ex.fillRect(x, yA - Math.round(h * 0.25), 1, Math.round(h * 0.25));
      }
    }
    if (t === "luna" && (jefe.horizonte > 0 || jefe.horizonteAviso)) {
      // Las dos orillas son la misma: una costura de luz en cada borde.
      const a = jefe.horizonteAviso ? 0.45 + 0.3 * Math.sin(tMusica * 16) : 0.75 * Math.min(1, jefe.horizonte);
      lx.fillStyle = "#c8f0ff";
      for (const x of [0, 1, W - 2, W - 1]) for (let y = 150 + ((Math.floor(tMusica * 30) + x * 7) % 8); y < H; y += 8) { lx.globalAlpha = a; lx.fillRect(x, y, 1, 4); }
      lx.globalAlpha = 1;
      brillo(2, M.Y_FANAL - 4, 16, "#8fd8ff", a * 0.6); brillo(W - 2, M.Y_FANAL - 4, 16, "#8fd8ff", a * 0.6);
    }
    if (t === "constelacion" && jefe.punta) {
      const u = jefe.punta, p = posHermana(jefe.hermanas[u.i]), d = Math.hypot(u.x - p.x, u.y - p.y) || 1;
      lx.fillStyle = "#c8f0ff";
      for (let s = 8; s < d; s += 6) { lx.globalAlpha = 0.35 + 0.5 * Math.min(1, u.q); lx.fillRect(Math.floor(p.x + (u.x - p.x) * s / d), Math.floor(p.y + (u.y - p.y) * s / d), 1, 1); }
      lx.globalAlpha = 1;
      brillo(p.x, p.y, 10 + 8 * u.q, "#c8f0ff", 0.8);
    }
    if (t === "sol" && jefe.ocaso) {
      // La línea que no tiene que tocar.
      const yT = Math.floor(M.Y_NAUFRAGIOS - 16);
      lx.fillStyle = jefe.ocaso.etapa === "aviso" && Math.floor(tMusica * 10) & 1 ? "#ffffff" : "#8fd8ff";
      for (let x = 2; x < W; x += 8) { lx.globalAlpha = 0.6; lx.fillRect(x, yT, 4, 1); }
      lx.globalAlpha = 1;
    }
  }

  /* ================================================================
     La fase 5 (desde la cuarta vuelta del sin fin)
     ================================================================
     «La del alba» (el modelo, en sprites.js: el cuerpo lleno del cielo
     del amanecer, rayos detrás). Cada jefe conserva sus tres habilidades
     y estrena una cuarta; rotan las cuatro, empezando por la nueva.

       Nodriza         Abrazo        polillas que no queman: se posan y pesan
       Faro            Prisma        luces lentas que, si les tiras, se parten
       Esfinge         Acertijo      muestra tres orillas en orden; recuérdalas
       Casco           Escora        todo se inclina: la barca, los tiros, las escamas
       Crisálida       Compás        filas de seda al ritmo de la música
       Hoguera         Yesca         prende tus cascos, uno tras otro
       Luna            Rayo de luna  un rayo fijo debajo de ella
       Siete Hermanas  Aurora        cortinas de luz que cruzan el agua
       Sol             Amanecer      sale por el horizonte: solo a la sombra larga de un casco

     Tampoco tocan la prueba: las polillas del Abrazo son larvas de la
     Nodriza (O), y lo demás no se rompe a tiros o no anota nada. */

  /* La Nodriza. ABRAZO: suelta polillas que no queman: vienen a tu luz y
     se te posan. Cada una pesa en los remos; remando fuerte un rato se
     espantan de a una, y si se juntan cinco ahogan la llama. Se les puede
     tirar antes de que lleguen. */
  function esp5Nodriza(dt, a5, f) {
    if (a5) {
      if (a5.t > 0.6 && !a5.hecho) {
        a5.hecho = 1; musica.sfx.aleteo();
        for (let i = 0; i < 4 + f; i++) larvas.push({ x: jefe.x + azar(-20, 20), y: jefe.y + 10, vx: azar(-60, 60), vy: azar(-20, 10), t: -i * 0.25, vida: 1, f: Math.random() * 6, abrazo: true });
      }
      if (a5.t > 1) jefe.ataque = null;
    }
    if (F.posadas > 0) {
      F.sacude = Math.abs(F.vx) > 70 ? F.sacude + dt : Math.max(0, F.sacude - dt * 0.5);
      if (F.sacude > 0.7) { F.sacude = 0; F.posadas--; chispas(F.x, M.Y_FANAL - 8, 6, ["#c8a07a", "#fff0c8"], 40, 0.5, "polvo"); musica.sfx.aleteo(); }
      if (F.posadas >= 5 && estado === "juego") { F.posadas = 0; F.sacude = 0; golpeFanal("abrazo"); }
    }
  }

  /* El Faro. PRISMA: suelta luces lentas, grandes, que caen a la deriva.
     No hay que tirarles: un tiro las parte en tres astillas rápidas que
     vienen hacia ti. Se esquivan, o se dispara entre ellas. */
  function esp5Faro(dt, a5, f) {
    if (!a5) return;
    const n = 4 + f;
    a5.k = a5.k || 0;
    if (a5.k < n && a5.t > 0.6 + a5.k * 0.45) {
      a5.k++; musica.sfx.roce(jefe.x);
      escamas.push(nuevaEscama(jefe.x + azar(-10, 10), jefe.y + 26, azar(-34, 34), 30, { jefe: true, prisma: true, estilo: 9 }));
    }
    if (a5.k >= n && a5.t > 0.9 + n * 0.45) jefe.ataque = null;
  }

  /* La Esfinge. ACERTIJO: enciende tres orillas, una tras otra, y las
     apaga. Después la noche golpea todo menos una orilla, en el mismo
     orden que las mostró: hay que recordarlo. Justo antes de cada golpe
     la orilla que salva asoma apenas, por si acaso. */
  const ZONAS = [56, 120, 184];
  function esp5Esfinge(dt, a5, f) {
    jefe.acertijo = null;
    jefe.acertijoGolpe = Math.max(0, (jefe.acertijoGolpe || 0) - dt);
    if (!a5) return;
    if (!a5.orden) {
      a5.orden = [];
      for (let i = 0; i < 3 + (f > 0 ? 1 : 0); i++) { let z; do z = Math.floor(Math.random() * 3); while (i && z === a5.orden[i - 1]); a5.orden.push(z); }
      a5.k = 0; musica.sfx.eclipse();
    }
    const muestra = 0.55, cada = 1.6 - f * 0.1, n = a5.orden.length, t0 = n * muestra + 0.5;
    if (a5.t < n * muestra) {
      const i = Math.floor(a5.t / muestra);
      jefe.acertijo = { ver: a5.orden[i], n: i }; jefe.marcas = 1;
      if (a5.son !== i) { a5.son = i; musica.sfx.ui(i + 1); }
    } else if (a5.k < n) {
      const q = clamp((a5.t - t0 - a5.k * cada) / cada, 0, 1);
      jefe.acertijo = { ver: null, n: a5.k, q, pista: q > 0.78 ? a5.orden[a5.k] : null };
      if (a5.t >= t0 + (a5.k + 1) * cada) {
        const z = a5.orden[a5.k++];
        jefe.acertijoGolpe = 0.35; jefe.acertijoZ = z;
        relampago("#d8c8ff", 0.25); sacude(0.15); musica.sfx.empuje();
        if (estado === "juego" && Math.abs(F.x - ZONAS[z]) > 24) golpeFanal("acertijo");
      }
    }
    if (a5.k >= n && a5.t > t0 + n * cada + 0.4) jefe.ataque = null;
  }

  /* El Casco. ESCORA: el barco se inclina, y con él todo: la barca resbala
     hacia el lado bajo, los tiros se van torcidos y las escamas caen de
     lado. A la mitad se inclina para el otro lado. */
  function esp5Casco(dt, a5, f) {
    if (a5) {
      if (!a5.hecho) { a5.hecho = 1; jefe.escora = { t: 0, dur: 7 + f, lado: Math.random() < 0.5 ? -1 : 1, k: 0 }; musica.sfx.ancla(); sacude(0.2); }
      if (a5.t > 0.8) jefe.ataque = null;
    }
    const e = jefe.escora;
    if (!e) return;
    e.t += dt;
    const lado = e.t < e.dur / 2 ? e.lado : -e.lado;
    e.k = lado * Math.min(suave(clamp(e.t / 0.8, 0, 1)), suave(clamp((e.dur - e.t) / 0.6, 0, 1)), suave(clamp(Math.abs(e.t - e.dur / 2) / 0.5, 0, 1)));
    // La barca resbala hacia el lado bajo (no por F.viento: los remos lo corrigen enseguida).
    if (estado === "juego" && F.capullo <= 0) F.x = clamp(F.x + e.k * (28 + f * 6) * dt, 10, W - 10);
    if (e.t > e.dur) jefe.escora = null;
  }

  /* La Crisálida. COMPÁS: late con la música. En cada uno del compás baja
     una fila de seda con un paso, corrido cada vez un poco a un lado y
     después al otro: se cruza bailando, al ritmo. El próximo paso se marca
     en el agua. (La fila la suelta alPulso.) El corrimiento es corto (de
     48 a 72 px): un compás de 7/8 al tempo de la fase 5 dura ~1 s. */
  function esp5Crisalida(dt, a5, f) {
    if (!a5) return;
    if (!a5.hecho) { a5.hecho = 1; jefe.compas = { n: 6 + 2 * f, lado: F.x < W / 2 ? 1 : -1, g: clamp(Math.round(F.x / 12) - 2, 1, 15) }; musica.sfx.barrido(0.5); }
    if (a5.t > 0.6) jefe.ataque = null;
  }
  function compasPulso(p) {
    const c = jefe.compas;
    if (!c || jefe.muerto || estado !== "juego" || p.nivel !== 2) return;
    c.n--;
    const g0 = c.g;
    c.g += c.lado * (4 + Math.floor(Math.random() * 3));
    if (c.g < 1 || c.g > 15) { c.lado *= -1; c.g = clamp(g0 + c.lado * (4 + Math.floor(Math.random() * 3)), 1, 15); }
    for (let i = 0; i < 20; i++) if (i < g0 || i > g0 + 3) escamas.push(nuevaEscama(i * 12 + 6, jefe.y + 30, 0, 70, { muro: true, ancho: true, jefe: true, estilo: 9 }));
    musica.sfx.roce(g0 * 12 + 24);
    if (c.n <= 0) jefe.compas = null;
  }

  /* La Hoguera. YESCA: prende los cascos hundidos, de a uno. Primero
     humean (y se marca el agua debajo); después arden un rato y gotean
     fuego: debajo de un casco encendido no hay refugio. Si no queda ningún
     casco, tira Tizones. */
  function esp5Hoguera(dt, a5, f) {
    const ar = jefe.yesca || (jefe.yesca = []);
    if (a5) {
      if (!a5.hecho) {
        a5.hecho = 1;
        const vivos = naufragios.filter(n => n.pix.some(r => r.some(Boolean)));
        if (!vivos.length) { jefe.ataque = { nombre: "esp2", t: 0, hecho: 0 }; avisa("✦ " + habilidad(2)); return; }
        vivos.sort(() => Math.random() - 0.5).slice(0, 2 + f).forEach((n, i) => ar.push({ n, t: -0.9 - i * 0.9, dur: 4 }));
        musica.sfx.llamarada(1);
      }
      if (a5.t > 1) jefe.ataque = null;
    }
    for (let i = ar.length - 1; i >= 0; i--) {
      const y = ar[i];
      y.t += dt;
      if (y.t > 0) {
        if (Math.random() < dt * 6) erosiona(y.n, Math.floor(Math.random() * y.n.w), 0, 1);   // se va quemando
        if (estado === "juego" && Math.abs(F.x - (y.n.x + y.n.w / 2)) < y.n.w / 2 + 3) golpeFanal("yesca");
      }
      if (y.t > y.dur) ar.splice(i, 1);
    }
  }

  /* La Luna. RAYO DE LUNA: un rayo quieto, de arriba abajo, justo debajo de
     ella, mientras sigue su arco. Debajo de un casco no llega. Es cuando
     no se le puede tirar de frente. */
  function esp5Luna(dt, a5, f) {
    jefe.rayoLuna = null;
    if (!a5) return;
    const carga = 1, dur = 5 + f;
    jefe.rayoLuna = { x: jefe.x, on: a5.t >= carga, w: 9 + f };
    if (a5.t >= carga) {
      if (!a5.sono) { a5.sono = 1; musica.sfx.barrido(dur); }
      if (estado === "juego" && Math.abs(F.x - jefe.x) < jefe.rayoLuna.w && !naufragioEn(F.x, M.Y_NAUFRAGIOS + 2)) golpeFanal("rayo");
    }
    if (a5.t > carga + dur) jefe.ataque = null;
  }

  /* Las Siete Hermanas. AURORA: cortinas de luz que cruzan el agua de lado
     a lado, todas para el mismo lado. Primero se insinúan; después queman.
     Se viaja en el hueco entre dos. */
  function esp5Constelacion(dt, a5, f) {
    if (a5) {
      if (!a5.hecho) {
        a5.hecho = 1;
        const n = 2 + (f > 0 ? 1 : 0), dir = Math.random() < 0.5 ? 1 : -1;
        jefe.aurora = { t: 0, dur: 7 + f, dir, v: 32 + f * 6, w: 24, bandas: Array.from({ length: n }, (_, i) => ({ x: ((i + 0.5) / n) * W + azar(-10, 10) })) };
        musica.sfx.barrido(1.2);
      }
      if (a5.t > 1) jefe.ataque = null;
    }
    const a = jefe.aurora;
    if (!a) return;
    a.t += dt;
    for (const b of a.bandas) { b.x += a.dir * a.v * dt; if (b.x > W + a.w) b.x -= W + 2 * a.w; if (b.x < -a.w) b.x += W + 2 * a.w; }
    a.on = a.t > 1.1 && a.t < a.dur - 0.4;
    if (a.on && estado === "juego") for (const b of a.bandas) if (Math.abs(F.x - b.x) < a.w / 2) { golpeFanal("aurora"); break; }
    if (a.t > a.dur) jefe.aurora = null;
  }

  /* El Sol. AMANECER: se va al horizonte, del lado de enfrente, y sale otra
     vez despacio. Su luz llega casi de costado: los cascos hundidos echan
     sombras largas sobre el agua, que se acortan y se corren mientras
     sube. Al sol el vidrio se calienta (como en la Canícula); a la sombra
     se enfría. Si no quedan cascos, hace Canícula. */
  function esp5Sol(dt, a5, f) {
    jefe.amanecer = null;
    if (!a5) return;
    if (a5.lado == null) {
      if (naufragios.filter(n => n.pix.some(r => r.some(Boolean))).length < 2) { jefe.ataque = { nombre: "esp2", t: 0, hecho: 0 }; avisa("✦ " + habilidad(2)); return; }
      a5.lado = F.x < W / 2 ? 1 : -1; a5.x0 = jefe.x; musica.sfx.eclipse();
    }
    const baja = 0.9, dur = 6.5 - f * 0.3, xs = a5.lado > 0 ? W - 16 : 16, y0 = 226;
    if (a5.t < baja) { const k = suave(a5.t / baja); jefe.x = lerp(a5.x0, xs, k); jefe.y = lerp(jefe.casaY, y0, k); return; }
    const k = suave(clamp((a5.t - baja) / dur, 0, 1));
    jefe.x = lerp(xs, W / 2, k * k); jefe.y = lerp(y0, jefe.casaY, k);
    jefe.amanecer = { x: jefe.x, y: jefe.y };
    let sombra = false;
    for (let i = 2; i < 24 && !sombra; i++) { const q = i / 24; if (naufragioEn(lerp(jefe.x, F.x, q), lerp(jefe.y, M.Y_FANAL - 4, q))) sombra = true; }
    F.calor = clamp(F.calor + dt * (sombra ? -1.4 : 0.75 + f * 0.1), 0, 1);
    if (F.calor >= 1 && estado === "juego") { F.calor = 0; golpeFanal("amanecer"); }
    if (a5.t > baja + dur) jefe.ataque = null;
  }
  const ESPECIALES5 = { nodriza: esp5Nodriza, faro: esp5Faro, esfinge: esp5Esfinge, casco: esp5Casco, crisalida: esp5Crisalida, hoguera: esp5Hoguera, luna: esp5Luna, constelacion: esp5Constelacion, sol: esp5Sol };

  /* Lo que las habilidades de la fase 5 ponen en pantalla (las polillas
     posadas están en dibujaFanal; las luces del Prisma, en dibujaEscamas). */
  function dibujaFase5() {
    const t = jefe.tipo;
    if (t === "esfinge" && jefe.acertijo) {
      const a = jefe.acertijo;
      for (let z = 0; z < 3; z++) {
        const x = ZONAS[z], lit = a.ver === z ? 1 : a.pista === z ? 0.3 : 0;
        lx.fillStyle = "#d8c8ff";
        for (let y = 200; y < H; y += 6) { lx.globalAlpha = 0.16 + 0.6 * lit; lx.fillRect(x - 24, y, 1, 3); lx.fillRect(x + 24, y, 1, 3); }
        if (lit) { lx.globalAlpha = 0.28 * lit; lx.fillRect(x - 23, 200, 47, H - 200); }
        lx.globalAlpha = 1;
      }
      ex.fillStyle = "#fffaf0";
      if (a.ver != null) for (let i = 0; i <= a.n; i++) ex.fillRect(Math.floor(ZONAS[a.ver] - a.n * 2 + i * 4 - 1), 192, 2, 2);   // cuál de la serie es
      else { ex.fillStyle = "#6a4a7a"; ex.fillRect(W / 2 - 20, 190, 40, 2); ex.fillStyle = "#d8c8ff"; ex.fillRect(W / 2 - 20, 190, Math.round(40 * a.q), 2); }
    }
    if (t === "esfinge" && jefe.acertijoGolpe > 0) {
      lx.fillStyle = "#d8c8ff";
      for (let x = 2; x < W; x += 4) if (Math.abs(x - ZONAS[jefe.acertijoZ]) > 24) { lx.globalAlpha = 0.55 * jefe.acertijoGolpe / 0.35; lx.fillRect(x, 140, 2, H - 140); }
      lx.globalAlpha = 1;
    }
    if (t === "casco" && jefe.escora) {
      // El horizonte inclinado y una lluvia que cae de lado.
      const k = jefe.escora.k;
      lx.fillStyle = "#fff2c8";
      for (let x = 0; x < W; x += 3) { lx.globalAlpha = 0.35 * Math.abs(k); lx.fillRect(x, Math.floor(M.Y_NAUFRAGIOS - 30 + (x - W / 2) * k * 0.18), 2, 1); }
      for (let i = 0; i < 18; i++) { const x = (i * 53 + Math.floor(tMusica * 90)) % W, y = 80 + ((i * 37 + Math.floor(tMusica * 160)) % 200); lx.globalAlpha = 0.25 * Math.abs(k); lx.fillRect(Math.floor(x + k * 6), y, 1, 3); lx.fillRect(Math.floor(x + k * 3), y + 3, 1, 2); }
      lx.globalAlpha = 1;
    }
    if (t === "crisalida" && jefe.compas) {
      // Dónde va a estar el paso de la próxima fila.
      lx.fillStyle = "#fff2c8"; lx.globalAlpha = 0.45 + 0.3 * Math.sin(tMusica * 10);
      lx.fillRect(jefe.compas.g * 12, M.Y_FANAL + 6, 48, 1);
      lx.globalAlpha = 1;
      brillo(jefe.x, jefe.y, 30 + 10 * pulsoLuz, "#fff2c8", 0.3 * pulsoLuz);
    }
    if (t === "hoguera") for (const y of jefe.yesca || []) {
      const n = y.n, x0 = Math.floor(n.x), w = n.w;
      if (y.t < 0) {
        lx.fillStyle = "#ffb040";
        for (let i = 0; i < 4; i++) { lx.globalAlpha = 0.5; lx.fillRect(x0 + ((i * 5 + Math.floor(tMusica * 8)) % w), Math.floor(n.y - 3 - ((tMusica * 20 + i * 7) % 14)), 1, 2); }
        lx.globalAlpha = 0.6 + 0.3 * Math.sin(tMusica * 20); lx.fillRect(x0, M.Y_FANAL + 6, w, 1); lx.globalAlpha = 1;
      } else for (let x = x0; x < x0 + w; x += 2) {
        const h = 4 + Math.round(4 * Math.abs(Math.sin(x + tMusica * 12)));
        ex.fillStyle = "#ff6a20"; ex.fillRect(x, n.y - h, 2, h);
        ex.fillStyle = "#ffd070"; ex.fillRect(x, n.y - Math.round(h / 2), 1, Math.round(h / 2));
        if ((x + Math.floor(tMusica * 30)) % 9 === 0) { ex.fillStyle = "#ffb040"; ex.fillRect(x, Math.floor(n.y + n.h + ((tMusica * 60 + x) % Math.max(1, M.Y_FANAL - n.y - n.h))), 1, 2); }
      }
    }
    if (t === "luna" && jefe.rayoLuna) {
      const r = jefe.rayoLuna, x = Math.floor(r.x), y0 = Math.floor(jefe.y + 18);
      const y1 = naufragioEn(r.x, M.Y_NAUFRAGIOS + 2) ? M.Y_NAUFRAGIOS - 6 : H;   // un casco lo corta
      lx.fillStyle = "#fffaf0";
      if (!r.on) for (let y = y0; y < H; y += 6) { lx.globalAlpha = 0.6; lx.fillRect(x - r.w, y, 1, 3); lx.fillRect(x + r.w, y, 1, 3); }
      else { for (let y = y0; y < y1; y += 2) { lx.globalAlpha = 0.35 + 0.15 * Math.sin(y * 0.3 + tMusica * 20); lx.fillRect(x - r.w + 1, y, r.w * 2 - 1, 2); } lx.globalAlpha = 0.9; lx.fillRect(x - 1, y0, 3, y1 - y0); }
      lx.globalAlpha = 1;
    }
    if (t === "constelacion" && jefe.aurora) {
      const a = jefe.aurora, cols = ["#7cffb4", "#ff8cb4", "#b48cff"];
      a.bandas.forEach((b, i) => {
        lx.fillStyle = cols[i % 3];
        for (let y = 60; y < H; y += 2) { const xx = Math.floor(b.x + Math.sin(y * 0.05 + tMusica * 2 + i) * 4); lx.globalAlpha = (a.on ? 0.34 : 0.1) * (0.6 + 0.4 * Math.sin(y * 0.11 - tMusica * 6)); lx.fillRect(Math.floor(xx - a.w / 2), y, a.w, 2); }
      });
      lx.globalAlpha = 1;
    }
    if (t === "sol" && jefe.amanecer) {
      // La luz baja: el agua al sol, iluminada; donde un casco la corta, sombra.
      const s = jefe.amanecer;
      for (let x = 2; x < W; x += 5) {
        let tapado = false;
        for (let i = 2; i < 24 && !tapado; i++) { const q = i / 24; if (naufragioEn(lerp(s.x, x, q), lerp(s.y, M.Y_FANAL - 4, q))) tapado = true; }
        if (tapado) continue;
        lx.fillStyle = "#ffd070"; lx.globalAlpha = 0.4; lx.fillRect(x - 2, M.Y_FANAL + 4, 5, 2);
        lx.globalAlpha = 0.1; for (let q = 0.55; q < 1; q += 0.08) lx.fillRect(Math.floor(lerp(s.x, x, q)), Math.floor(lerp(s.y, M.Y_FANAL - 4, q)), 1, 2);
      }
      lx.globalAlpha = 1;
    }
  }

  /* ================================================================
     La fase 6 (desde la quinta vuelta del sin fin)
     ================================================================
     «La de vidrio» (el modelo, en sprites.js: el cuerpo hecho vitral, un
     rosetón detrás). Cada jefe conserva sus cuatro habilidades y estrena
     una quinta; rotan las cinco, empezando por la nueva.

       Nodriza         Muda           deja su piel de vidrio, que también dispara
       Faro            Caleidoscopio  haces desde la lente: se marcan antes de encenderse
       Esfinge         Esquirlas      vidrios clavados en el agua: no se tocan
       Casco           Botellas       caen al agua, flotan hacia ti y revientan
       Crisálida       Vidriera       filas de vidrio que bajan: se pasa por el hueco o a tiros
       Hoguera         Colada         un chorro de vidrio fundido que te sigue
       Luna            Agua de vidrio el agua se vuelve espejo: la barca resbala
       Siete Hermanas  Celosía        una reja de vidrios en diagonal
       Sol             Lupa           el sol te enfoca: no te quedes en el punto

     Y el RIGOR (motor.js: aplicaRigor): cada vuelta en la fase 6 es un
     grado más dura que la anterior. El jefe tiene más vida en pantalla
     (`M.vidaJefeJuego`), ataca más seguido y sus escamas van más rápido;
     sus habilidades nuevas, además, traen más de todo con cada grado
     (`masGrado`) y llegan antes (`cdEsp`).

     Tampoco tocan la prueba: romper la Muda paga como lo que orbita (V,
     que cualquier jefe tiene desde la fase 3); los vidrios de la Vidriera
     se rompen sin anotar nada, como la red de la Crisálida; lo demás no
     se rompe a tiros. */
  const masGrado = () => Math.min(3, Math.max(0, (jefe.grado || 1) - 1));

  /* La Nodriza. MUDA: se desprende de su piel, que queda colgada en el
     aire, de vidrio, y dispara sus abanicos por su cuenta mientras ella
     sigue con lo suyo. A tiros se rompe (y paga). */
  function esp6Nodriza(dt, a6, f) {
    if (a6) {
      if (a6.t > 0.5 && !a6.hecho) {
        a6.hecho = 1; musica.sfx.aleteo(); relampago("#ffc8e8", 0.2);
        const g = masGrado();
        jefe.muda = { x: jefe.x, y: jefe.y, y0: jefe.y, t: 0, dur: 9 + f + g, vida: 12 + 4 * f + 5 * g, cd: 1.1, flash: 0 };
        chispas(jefe.x, jefe.y, 24, ["#ff4c9c", "#5cf0d8", "#ffc83c"], 50, 0.8, "polvo");
      }
      if (a6.t > 0.9) jefe.ataque = null;
    }
    const m = jefe.muda;
    if (!m) return;
    m.t += dt; m.flash = Math.max(0, m.flash - dt); m.cd -= dt;
    m.y = m.y0 + Math.sin(m.t * 1.1) * 4;                              // cuelga, y se mece apenas
    if (m.cd <= 0 && m.t < m.dur - 0.5 && estado === "juego") {
      m.cd = 1.6 - f * 0.15 - masGrado() * 0.12;
      abanico(m.x, m.y + 14, 5 + f, 0.8, 66 + f * 8, { estilo: 9, vidrio: true });
      musica.sfx.roce(m.x);
    }
    if (m.t > m.dur) { chispas(m.x, m.y, 18, ["#ff4c9c", "#5cf0d8", "#fff6d8"], 40, 0.6, "polvo"); jefe.muda = null; }
  }

  /* El Faro. CALEIDOSCOPIO: la lente, hecha vitral, abre seis haces en
     abanico hacia el agua. Cada vez que gira (un clic) se encienden
     algunos; antes se marcan punteados. Se espera donde no se va a
     encender, o debajo de un casco, que corta el haz. */
  const HACES_CALEI = 6;
  function esp6Faro(dt, a6, f) {
    jefe.calei = null;
    if (!a6) return;
    const g = masGrado(), clics = 4 + f + g, aviso = 0.75 - g * 0.06, luz = 0.55, cada = aviso + luz + 0.1;
    if (!a6.sets) {
      a6.sets = [];
      let antes = -1;
      for (let i = 0; i < clics; i++) {
        let m;
        do {
          m = 0;
          const prender = Math.min(HACES_CALEI - 1, 3 + (f === 2 ? 1 : 0) + (g >= 2 ? 1 : 0));
          const orden = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
          for (let k = 0; k < prender; k++) m |= 1 << orden[k];
        } while (m === antes);
        a6.sets.push(antes = m);
      }
      musica.sfx.eclipse();
    }
    const i = Math.floor((a6.t - 0.3) / cada), q = (a6.t - 0.3) - i * cada;
    if (a6.t >= 0.3 && i < clics) {
      const on = q >= aviso && q < aviso + luz;
      jefe.calei = { m: a6.sets[i], on };
      if (on && a6.son !== i) { a6.son = i; musica.sfx.barrido(luz); relampago("#c8f0ff", 0.12); }
      if (on && estado === "juego") for (let k = 0; k < HACES_CALEI; k++) if (a6.sets[i] & (1 << k) && enHazCalei(k)) { golpeFanal("caleidoscopio"); break; }
    }
    if (a6.t > 0.3 + clics * cada + 0.2) jefe.ataque = null;
  }
  /* Adónde llega el haz `k` al agua, y si la barca está en él (sin un casco en el medio). */
  const xHazCalei = k => ((k + 0.5) / HACES_CALEI) * W;
  function enHazCalei(k) {
    const x0 = jefe.x, y0 = jefe.y + 8;
    if (Math.abs(F.x - xHazCalei(k)) > 9) return false;
    for (let s = 2; s < 24; s++) { const q = s / 24; if (naufragioEn(lerp(x0, F.x, q), lerp(y0, M.Y_FANAL - 4, q))) return false; }
    return true;
  }

  /* La Esfinge. ESQUIRLAS: se rompe un poco y tira los pedazos, que caen
     marcados y se quedan clavados en el agua, de punta. Tocar uno quiebra
     la llama; pasado un rato se hunden. */
  function esp6Esfinge(dt, a6, f) {
    const lista = jefe.esquirlas || (jefe.esquirlas = []);
    if (a6) {
      if (a6.t > 0.6 && !a6.hecho) {
        a6.hecho = 1; musica.sfx.escudo(); sacude(0.15);
        const n = 3 + f + masGrado(), xs = [];
        xs.push(clamp(F.x + azar(-6, 6), 12, W - 12));           // una, siempre donde estás
        for (let tries = 0; xs.length < n && tries < 200; tries++) { const x = azar(12, W - 12); if (xs.every(o => Math.abs(o - x) > 30)) xs.push(x); }
        xs.forEach((x, i) => lista.push({ x, x0: jefe.x, y0: jefe.y, t: -0.9 - i * 0.12, dur: 5 + f + masGrado() }));
      }
      if (a6.t > 1) jefe.ataque = null;
    }
    for (let i = lista.length - 1; i >= 0; i--) {
      const s = lista[i];
      s.t += dt;
      if (s.t >= 0 && !s.clavada) { s.clavada = true; chispas(s.x, M.Y_FANAL + 2, 6, ["#5cf0d8", "#fff6d8"], 30, 0.4); musica.sfx.roce(s.x); }
      if (s.t >= 0 && estado === "juego" && Math.abs(F.x - s.x) < 5) { golpeFanal("esquirla"); chispas(s.x, M.Y_FANAL - 4, 12, ["#ff4c9c", "#5cf0d8", "#fff6d8"], 50, 0.5); lista.splice(i, 1); continue; }
      if (s.t > s.dur) lista.splice(i, 1);
    }
  }

  /* El Casco. BOTELLAS: suelta botellas de vidrio que caen al agua, flotan
     despacio hacia ti y, al rato, revientan. Antes de reventar se marca en
     el agua hasta dónde llega. Se aleja uno, o se las deja pasar. */
  function esp6Casco(dt, a6, f) {
    const lista = jefe.botellas || (jefe.botellas = []);
    if (a6) {
      const n = 3 + f + masGrado();
      a6.k = a6.k || 0;
      if (a6.k < n && a6.t > 0.5 + a6.k * 0.35) {
        a6.k++; musica.sfx.ancla();
        lista.push({ x: jefe.x + azar(-14, 14), y: jefe.y + 18, vx: azar(-50, 50), vy: 30, t: 0, flota: false, cuenta: 2.5 - f * 0.15 - masGrado() * 0.1, r: 22 + 2 * masGrado(), c: lista.length % 3 });
      }
      if (a6.k >= n && a6.t > 0.9 + n * 0.35) jefe.ataque = null;
    }
    for (let i = lista.length - 1; i >= 0; i--) {
      const b = lista[i];
      b.t += dt;
      if (!b.flota) {
        b.vy = Math.min(150, b.vy + 220 * dt); b.x = clamp(b.x + b.vx * dt, 10, W - 10); b.y += b.vy * dt;
        if (b.y >= Y_AGUA - 1) { b.y = Y_AGUA - 1; b.flota = true; chispas(b.x, Y_AGUA, 6, ["#8fd8ff", "#ffffff"], 30, 0.4); musica.sfx.roce(b.x); }
        continue;
      }
      b.x = clamp(b.x + Math.sign(F.x - b.x) * 12 * dt, 10, W - 10);
      b.cuenta -= dt;
      if (b.cuenta <= 0) {
        lista.splice(i, 1);
        anillo(b.x, Y_AGUA - 3, "#5cf0d8", b.r); chispas(b.x, Y_AGUA - 3, 18, ["#ff4c9c", "#5cf0d8", "#ffc83c", "#fff6d8"], 70, 0.6);
        musica.sfx.empuje(); sacude(0.12);
        if (estado === "juego" && Math.abs(F.x - b.x) < b.r) golpeFanal("botella");
      }
    }
  }

  /* La Crisálida. VIDRIERA: teje con vidrio de colores. Bajan filas de
     vidrios de lado a lado, cada una con un hueco; si una fila llega al
     agua con un vidrio encima de ti, te quiebra. Los tiros los rompen (sin
     anotar nada, como su red). */
  function esp6Crisalida(dt, a6, f) {
    const filas = jefe.vidriera || (jefe.vidriera = []);
    if (a6) {
      if (!a6.hecho) {
        a6.hecho = 1; musica.sfx.barrido(0.8);
        const n = 2 + (f > 0 ? 1 : 0) + (masGrado() >= 2 ? 1 : 0);
        for (let r = 0; r < n; r++) {
          const hueco = Math.floor(Math.random() * 19);
          filas.push({ y: jefe.y + 24 - r * 30, vy: 22 + 4 * f + 3 * masGrado(), segs: Array.from({ length: 20 }, (_, i) => i !== hueco && i !== hueco + 1), c: r });
        }
      }
      if (a6.t > 0.8) jefe.ataque = null;
    }
    for (let i = filas.length - 1; i >= 0; i--) {
      const r = filas[i];
      r.y += r.vy * dt;
      if (r.y >= M.Y_FANAL - 9) {
        filas.splice(i, 1);
        const k = Math.floor(F.x / 12), encima = r.segs[k] || (F.x - k * 12 < 4 && r.segs[k - 1]) || (F.x - k * 12 > 8 && r.segs[k + 1]);
        for (let s = 0; s < 20; s += 2) if (r.segs[s]) chispas(s * 12 + 6, r.y, 2, ["#ff4c9c", "#5cf0d8", "#ffc83c"], 30, 0.4);
        musica.sfx.escudo();
        if (estado === "juego" && encima) golpeFanal("vidriera");
      }
    }
  }

  /* La Hoguera. COLADA: funde los vidrios de los fanales que tenía y los
     derrama: un chorro de vidrio al rojo que cae al agua y te sigue, más
     lento que tus remos. Un casco lo ataja (y se va quemando). */
  function esp6Hoguera(dt, a6, f) {
    jefe.colada = null;
    if (!a6) return;
    const g = masGrado(), carga = 0.9, dur = 5 + f + g * 0.5;
    if (a6.x == null) { a6.x = jefe.x; musica.sfx.llamarada(1); }
    const v = 46 + 8 * f + 7 * g;
    a6.x = clamp(a6.x + clamp(F.x - a6.x, -v * dt, v * dt), 6, W - 6);
    const tope = naufragioEn(a6.x, M.Y_NAUFRAGIOS + 2);
    jefe.colada = { x: a6.x, on: a6.t >= carga, w: 6 + f, tope: tope ? tope.n : null };
    if (a6.t >= carga) {
      if (tope && Math.random() < dt * 8) erosiona(tope.n, Math.floor(Math.random() * tope.n.w), 0, 1);
      if (!tope && estado === "juego" && Math.abs(F.x - a6.x) < jefe.colada.w) golpeFanal("colada");
    }
    if (a6.t > carga + dur) jefe.ataque = null;
  }

  /* La Luna. AGUA DE VIDRIO: el agua se vuelve un espejo liso. Los remos
     no agarran: la barca tarda en arrancar y en frenar, y resbala (ver
     actualizaFanal). Mientras tanto ella sigue con lo suyo. */
  function esp6Luna(dt, a6, f) {
    if (a6) {
      if (!a6.hecho) { a6.hecho = 1; jefe.aguaVidrio = 6 + f + masGrado(); musica.sfx.eclipse(); relampago("#e8f4ff", 0.2); }
      if (a6.t > 0.7) jefe.ataque = null;
    }
    if (jefe.aguaVidrio > 0) jefe.aguaVidrio = Math.max(0, jefe.aguaVidrio - dt);
  }

  /* Las Siete Hermanas. CELOSÍA: se ordenan como un rosetón y dejan caer
     una reja de vidrios: filas que bajan en diagonal, cada una corrida un
     poco respecto de la anterior, de modo que los huecos forman pasillos
     torcidos. Se rema con la reja, o se abre paso a tiros. */
  function esp6Constelacion(dt, a6, f) {
    if (!a6) return;
    const g = masGrado(), filas = 7 + 2 * f + 2 * g, cada = 0.62 - 0.04 * f - 0.03 * g;
    if (a6.dir == null) { a6.dir = Math.random() < 0.5 ? 1 : -1; a6.k = 0; a6.x0 = azar(0, 24); musica.sfx.barrido(filas * cada); }
    if (a6.k < filas && a6.t > 0.6 + a6.k * cada) {
      const corre = a6.x0 + a6.dir * a6.k * 8;
      for (let x = ((corre % 24) + 24) % 24; x < W; x += 24) escamas.push(nuevaEscama(x, 44, a6.dir * 26, 52, { jefe: true, estilo: 9, vidrio: true }));
      a6.k++; musica.sfx.roce(W / 2);
    }
    if (a6.k >= filas && a6.t > 0.8 + filas * cada) jefe.ataque = null;
  }

  /* El Sol. LUPA: te mira a través de una lupa. El punto donde enfoca cae
     sobre el agua y te sigue, más lento que tus remos; en él el vidrio se
     calienta rápido (como en la Canícula) y fuera se enfría. Debajo de un
     casco no hay foco. */
  function esp6Sol(dt, a6, f) {
    jefe.lupa = null;
    if (!a6) return;
    const g = masGrado(), dur = 6.5 + f * 0.5 + g * 0.5, v = 40 + 8 * f + 7 * g;
    if (a6.x == null) { a6.x = F.x < W / 2 ? W - 20 : 20; musica.sfx.llamarada(1); }
    a6.x = clamp(a6.x + clamp(F.x - a6.x, -v * dt, v * dt), 8, W - 8);
    const sombra = !!naufragioEn(F.x, M.Y_NAUFRAGIOS + 2), dentro = Math.abs(F.x - a6.x) < 13;
    jefe.lupa = { x: a6.x, on: a6.t > 0.8 };
    if (a6.t > 0.8) {
      F.calor = clamp(F.calor + dt * (dentro && !sombra ? 1.5 + 0.2 * f + 0.15 * g : -0.7), 0, 1);
      if (F.calor >= 1 && estado === "juego") { F.calor = 0; golpeFanal("lupa"); }
    }
    if (a6.t > 0.8 + dur) jefe.ataque = null;
  }
  const ESPECIALES6 = { nodriza: esp6Nodriza, faro: esp6Faro, esfinge: esp6Esfinge, casco: esp6Casco, crisalida: esp6Crisalida, hoguera: esp6Hoguera, luna: esp6Luna, constelacion: esp6Constelacion, sol: esp6Sol };

  /* Lo que las habilidades de la fase 6 ponen en pantalla (la Muda, en
     dibujaJefe; los vidrios de la Celosía, en dibujaEscamas). */
  const JOYAS = ["#ff4c9c", "#5cf0d8", "#ffc83c", "#8c5cff"];
  function dibujaFase6() {
    const t = jefe.tipo;
    if (t === "faro" && jefe.calei) {
      const c = jefe.calei, x0 = jefe.x, y0 = jefe.y + 8;
      for (let k = 0; k < HACES_CALEI; k++) {
        if (!(c.m & (1 << k))) continue;
        const x1 = xHazCalei(k), y1 = M.Y_FANAL - 3, n = 60;
        lx.fillStyle = JOYAS[k % JOYAS.length];
        for (let s = 3; s <= n; s++) {
          const q = s / n, px = lerp(x0, x1, q), py = lerp(y0, y1 + 12, q);
          if (naufragioEn(px, py)) break;                                // un casco corta el haz
          if (c.on) { lx.globalAlpha = 0.5; lx.fillRect(Math.floor(px) - 2, Math.floor(py), 5, 3); }
          else if (s % 3 === 0) { lx.globalAlpha = 0.6; lx.fillRect(Math.floor(px) - 4, Math.floor(py), 1, 1); lx.fillRect(Math.floor(px) + 4, Math.floor(py), 1, 1); }
        }
        lx.globalAlpha = 1;
      }
    }
    if (t === "esfinge") for (const s of jefe.esquirlas || []) {
      if (s.t < 0) {
        const q = clamp(1 + s.t / 0.9, 0, 1), y = lerp(s.y0, M.Y_FANAL, q * q), x = lerp(s.x0, s.x, q);
        lx.fillStyle = "#5cf0d8";
        for (let yy = 200; yy < H; yy += 6) { lx.globalAlpha = 0.5; lx.fillRect(Math.floor(s.x) - 5, yy, 1, 3); lx.fillRect(Math.floor(s.x) + 5, yy, 1, 3); }
        lx.globalAlpha = 1;
        ex.fillStyle = "#5cf0d8"; ex.fillRect(Math.floor(x) - 1, Math.floor(y) - 3, 3, 6); ex.fillStyle = "#fff6d8"; ex.fillRect(Math.floor(x), Math.floor(y) - 3, 1, 3);
      } else {
        const x = Math.floor(s.x), hunde = s.t > s.dur - 0.6 ? Math.round((s.t - (s.dur - 0.6)) * 14) : 0, y = M.Y_FANAL + 4 + hunde;
        ex.fillStyle = "#2c4cc8"; ex.fillRect(x - 2, y - 12, 5, 12 - hunde);
        ex.fillStyle = "#5cf0d8"; ex.fillRect(x - 1, y - 14, 3, 13 - hunde);
        ex.fillStyle = "#fff6d8"; ex.fillRect(x, y - 15, 1, 6);
        brillo(s.x, y - 8, 8, "#5cf0d8", 0.4);
      }
    }
    if (t === "casco") for (const b of jefe.botellas || []) {
      const x = Math.floor(b.x), y = Math.floor(b.y + (b.flota ? Math.sin(b.t * 6) * 1.2 : 0)), col = JOYAS[b.c % JOYAS.length];
      ex.fillStyle = "#140c1c"; ex.fillRect(x - 3, y - 7, 6, 9);
      ex.fillStyle = col; ex.fillRect(x - 2, y - 4, 4, 6); ex.fillRect(x - 1, y - 7, 2, 3);
      ex.fillStyle = "#fff6d8"; ex.fillRect(x - 1, y - 3, 1, 3);
      if (b.flota) {
        const urge = b.cuenta < 0.8 && Math.floor(tMusica * 14) & 1;
        lx.fillStyle = urge ? "#ffffff" : col;
        for (let dx = -b.r; dx <= b.r; dx += 4) { lx.globalAlpha = 0.5; lx.fillRect(Math.floor(b.x + dx), Y_AGUA + 2, 2, 1); }
        lx.globalAlpha = 1;
        brillo(b.x, y - 3, 8 + 6 * (1 - b.cuenta / 2.5), col, 0.5);
      }
    }
    if (t === "crisalida") for (const r of jefe.vidriera || []) {
      const y = Math.floor(r.y);
      for (let i = 0; i < 20; i++) {
        if (!r.segs[i]) continue;
        ex.fillStyle = "#140c1c"; ex.fillRect(i * 12, y - 3, 12, 6);
        ex.fillStyle = JOYAS[(i + r.c) % JOYAS.length]; ex.fillRect(i * 12 + 1, y - 2, 10, 4);
        ex.fillStyle = "#fff6d8"; ex.fillRect(i * 12 + 2, y - 2, 3, 1);
      }
      // Dónde va a caer, marcado en el agua.
      lx.fillStyle = "#fff6d8";
      for (let i = 0; i < 20; i++) if (!r.segs[i]) { lx.globalAlpha = 0.35; lx.fillRect(i * 12 + 2, M.Y_FANAL + 6, 8, 1); }
      lx.globalAlpha = 1;
    }
    if (t === "hoguera" && jefe.colada) {
      const c = jefe.colada, x = Math.floor(c.x), y0 = Math.floor(jefe.y + 26 * escalaJefe());
      const y1 = c.tope ? Math.floor(c.tope.y) : H;
      if (!c.on) { lx.fillStyle = "#ffc83c"; for (let y = y0; y < H; y += 6) { lx.globalAlpha = 0.55; lx.fillRect(x - c.w, y, 1, 3); lx.fillRect(x + c.w, y, 1, 3); } lx.globalAlpha = 1; }
      else {
        for (let y = y0; y < y1; y += 2) {
          const ond = Math.round(Math.sin(y * 0.2 + tMusica * 14) * 1.5);
          ex.fillStyle = "#c8284c"; ex.fillRect(x - c.w + 1 + ond, y, c.w * 2 - 1, 2);
          ex.fillStyle = (y >> 2) & 1 ? "#ffc83c" : "#ff8c3c"; ex.fillRect(x - c.w + 3 + ond, y, c.w * 2 - 5, 2);
          ex.fillStyle = "#fff6d8"; ex.fillRect(x - 1 + ond, y, 2, 2);
        }
        if (!c.tope) chispas(c.x, M.Y_FANAL + 2, 1, ["#ffc83c", "#ff4c9c"], 40, 0.3);
      }
    }
    if (t === "luna" && jefe.aguaVidrio > 0) {
      // El agua, un espejo: franjas de brillo y el reflejo de la barca.
      const a = Math.min(1, jefe.aguaVidrio / 0.6);
      lx.fillStyle = "#e8f4ff";
      for (let x = 0; x < W; x += 6) { lx.globalAlpha = 0.22 * a * (0.6 + 0.4 * Math.sin(x * 0.3 + tMusica * 3)); lx.fillRect(x, Y_AGUA + 2 + ((x / 6) % 3), 4, 1); }
      lx.globalAlpha = 0.5 * a; lx.fillRect(Math.floor(F.x - 6), Y_AGUA + 6, 13, 1); lx.fillRect(Math.floor(F.x - 3), Y_AGUA + 9, 7, 1);
      lx.globalAlpha = 1;
    }
    if (t === "sol" && jefe.lupa) {
      const l = jefe.lupa, x = Math.floor(l.x), y = Y_AGUA - 3;
      lx.fillStyle = "#ffd070";
      for (let q = 0.2; q < 1; q += 0.05) { lx.globalAlpha = 0.12 + 0.18 * q; lx.fillRect(Math.floor(lerp(jefe.x - 14, x - 3 * q, q)), Math.floor(lerp(jefe.y, y, q)), 1, 2); lx.fillRect(Math.floor(lerp(jefe.x + 14, x + 3 * q, q)), Math.floor(lerp(jefe.y, y, q)), 1, 2); }
      lx.globalAlpha = l.on ? 0.75 : 0.35; lx.fillRect(x - 12, y + 4, 25, 1);
      lx.globalAlpha = 1;
      if (l.on) { brillo(l.x, y, 14 + 3 * Math.sin(tMusica * 18), "#fff2c8", 0.8); ex.fillStyle = "#ffffff"; ex.fillRect(x - 1, y - 1, 3, 3); }
    }
  }
  /* La Muda de la Nodriza: su piel de vidrio, que parpadea. */
  function dibujaMuda() {
    const m = jefe.muda;
    if (!m) return;
    const sale = m.t > m.dur - 0.8 ? Math.floor(tMusica * 16) & 1 : 1;
    ex.globalAlpha = (0.45 + 0.15 * Math.sin(tMusica * 9)) * sale;
    pintaCuerpo(banco.nodriza(Math.floor(m.t * 4) % 3, m.flash > 0, 6), m.x, m.y);
    ex.globalAlpha = 1;
    brillo(m.x, m.y, 26, "#ff8cd8", 0.18);
  }
  /* Lo que un tiro rompe de la fase 6: un vidrio de la Vidriera (no anota
     nada) o la Muda (paga como lo que orbita al romperse). */
  function golpeaFase6(b) {
    for (const r of jefe.vidriera || []) if (Math.abs(b.y - r.y) < 4) {
      const i = Math.floor(b.x / 12);
      if (r.segs[i]) { r.segs[i] = false; chispas(b.x, r.y, 6, [JOYAS[(i + r.c) % JOYAS.length], "#fff6d8"], 32, 0.4); musica.sfx.roce(b.x); return true; }
    }
    const m = jefe.muda;
    if (m && !b.tocados.has(m) && Math.abs(b.x - m.x) < 18 * escalaJefe() && Math.abs(b.y - m.y) < 12 * escalaJefe()) {
      b.tocados.add(m); m.flash = 0.07; musica.sfx.escudo(); chispas(b.x, b.y, 4, ["#ff4c9c", "#5cf0d8"], 30, 0.3);
      m.vida -= b.dano;
      if (m.vida <= 0) { pagaOrbita(b, m.x, m.y); chispas(m.x, m.y, 30, ["#ff4c9c", "#5cf0d8", "#ffc83c", "#fff6d8"], 70, 0.9, "polvo"); anillo(m.x, m.y, "#ff8cd8", 30); jefe.muda = null; avisa("La piel se rompió"); }
      return true;
    }
    return false;
  }

  /* ================================================================
     La fase 7 (desde la sexta vuelta del sin fin)
     ================================================================
     «La de oro» (el modelo, en sprites.js: el vitral se rompió y lo
     unieron con oro; laca negra en pedazos, vetas de oro, una aureola de
     pan de oro detrás). Cada jefe conserva sus cinco habilidades y estrena
     una sexta; rotan las seis, empezando por la nueva.

       Nodriza         Pan de oro         hojas de oro que bajan meciéndose
       Faro            Grieta             un haz donde estás, que se abre en dos
       Esfinge         Tres cálices       la luz bajo un cáliz; los otros dos golpean
       Casco           Cofre              monedas que caen donde se marcan
       Crisálida       Costura            una aguja que cose el agua de lado a lado
       Hoguera         Oro fundido        gotas que se vuelven charcos que se abren
       Luna            Halo               un anillo de escamas que se suelta y cae
       Siete Hermanas  Grietas del cielo  el cielo se raja entre ellas y se derrama
       Sol             Fulgor             una ola de oro que cruza el agua; solo
                                          la sombra marcada (o un casco) protege

     El rigor sigue contando: la primera vuelta en la fase 7 ya es el grado
     2 (motor.js: gradoDeVuelta), y `masGrado` trae más de todo.

     Tampoco tocan la prueba: lo único que se rompe a tiros son escamas (las
     hojas, el halo, lo que derraman las grietas), que se anulan sin anotar
     nada, como todas; lo demás no se rompe. */

  /* La Nodriza. PAN DE ORO: sacude las alas y suelta hojas de oro que
     titilan un instante arriba y después bajan meciéndose de lado a lado. */
  function esp7Nodriza(dt, a7, f) {
    if (!a7) return;
    if (a7.t > 0.5 && !a7.hecho) {
      a7.hecho = 1; musica.sfx.aleteo(); relampago("#ffe6a0", 0.15);
      const g = masGrado(), n = 12 + 3 * f + 3 * g;
      for (let i = 0; i < n; i++) escamas.push(nuevaEscama(10 + ((i + Math.random()) / n) * (W - 20), azar(40, 100), 0, azar(30, 40) + 4 * g, { jefe: true, hoja: true, vaiven: azar(16, 24), fr: azar(1.5, 2.3), ph: Math.random() * 6, espera: 0.5 + Math.random() * 0.3 }));
    }
    if (a7.t > 1) jefe.ataque = null;
  }

  /* El Faro. GRIETA: la lente se raja y la grieta alumbra justo donde
     estás (marcada antes con dos líneas punteadas). Al encenderse se abre
     en dos haces que se apartan hacia las orillas: hay que salir de la
     marca a tiempo y no dejar que te alcance uno de los dos. Un casco corta
     el haz. */
  function esp7Faro(dt, a7, f) {
    jefe.grieta = null;
    if (!a7) return;
    const g = masGrado(), veces = 2 + (f === 2 ? 1 : 0) + (g >= 2 ? 1 : 0), aviso = 0.8 - 0.05 * g, abre = 1.5, cada = aviso + abre + 0.15, v = 70 + 10 * f + 8 * g;
    const i = Math.floor((a7.t - 0.3) / cada), q = a7.t - 0.3 - i * cada;
    if (a7.t >= 0.3 && i < veces) {
      if (a7.k !== i) { a7.k = i; a7.x = clamp(F.x, 8, W - 8); musica.sfx.eclipse(); }
      const on = q >= aviso && q < aviso + abre, d = on ? (q - aviso) * v : 0;
      jefe.grieta = { x: a7.x, d, on };
      if (on && a7.son !== i) { a7.son = i; musica.sfx.barrido(abre); relampago("#fff0b0", 0.15); }
      if (on && estado === "juego" && !naufragioEn(F.x, M.Y_NAUFRAGIOS + 2) && (Math.abs(F.x - (a7.x - d)) < 6 || Math.abs(F.x - (a7.x + d)) < 6)) golpeFanal("grieta");
    }
    if (a7.t > 0.3 + veces * cada) jefe.ataque = null;
  }

  /* La Esfinge. TRES CÁLICES: deja tres cálices de oro sobre el agua y
     muestra bajo cuál está la luz. Los tapa y los cambia de lugar, de dos
     en dos; al levantarlos, los dos sin luz derraman fuego sobre su tercio
     del agua. Hay que seguir el de la luz (o estar bajo un casco). */
  const X_CALIZ = [W / 6, W / 2, (5 * W) / 6], Y_CALIZ = 236;
  function esp7Esfinge(dt, a7, f) {
    jefe.calices = null;
    if (!a7) return;
    const g = masGrado();
    if (!a7.plan) {
      const n = 3 + f + g, paso = Math.max(0.3, 0.55 - 0.04 * f - 0.04 * g), tras = [[0, 1, 2]];
      for (let k = 0; k < n; k++) {
        const a = Math.floor(Math.random() * 3), b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
        tras.push(tras[k].map(s => (s === a ? b : s === b ? a : s)));      // los cálices de los lugares a y b se cambian
      }
      a7.plan = { luz: Math.floor(Math.random() * 3), n, paso, tras };
      musica.sfx.escudo();
    }
    const p = a7.plan, MUESTRA = 1.4, fin = MUESTRA + p.n * p.paso, golpe = fin + 0.7, dura = 0.6;
    const k = a7.t < MUESTRA ? 0 : Math.min(p.n, Math.floor((a7.t - MUESTRA) / p.paso));
    const u = a7.t < MUESTRA || k >= p.n ? 0 : suave((a7.t - MUESTRA - k * p.paso) / p.paso);
    if (a7.t >= MUESTRA && k < p.n && a7.son !== k) { a7.son = k; musica.sfx.roce(W / 2); }
    const destino = p.tras[Math.min(p.n, k + (u > 0 ? 1 : 0))], ahora = p.tras[k];
    const xs = [0, 1, 2].map(c => lerp(X_CALIZ[ahora[c]], X_CALIZ[destino[c]], u));
    const ys = [0, 1, 2].map(c => Y_CALIZ + (destino[c] !== ahora[c] ? (destino[c] > ahora[c] ? -1 : 1) * Math.sin(Math.PI * u) * 10 : 0));
    const alza = a7.t < MUESTRA - 0.3 ? 1 : a7.t < MUESTRA ? (MUESTRA - a7.t) / 0.3 : a7.t > fin + 0.25 ? Math.min(1, (a7.t - fin - 0.25) / 0.3) : 0;
    const malos = [0, 1, 2].filter(c => c !== p.luz).map(c => p.tras[p.n][c]);
    const on = a7.t >= golpe && a7.t < golpe + dura;
    jefe.calices = { xs, ys, luz: p.luz, alza, malos: a7.t >= fin ? malos : null, on };
    if (on && !a7.sono) { a7.sono = 1; musica.sfx.llamarada(dura); relampago("#ffd070", 0.25); sacude(0.15); }
    if (on && estado === "juego" && !naufragioEn(F.x, M.Y_NAUFRAGIOS + 2) && malos.some(s => Math.abs(F.x - X_CALIZ[s]) < W / 6 - 2)) golpeFanal("caliz");
    if (a7.t > golpe + dura + 0.2) jefe.ataque = null;
  }

  /* El Casco. COFRE: abre el cofre y las monedas saltan en arco. Cada una
     marca en el agua dónde va a caer (una, siempre donde estás). Un casco
     encima la ataja. */
  function esp7Casco(dt, a7, f) {
    const lista = jefe.monedas || (jefe.monedas = []);
    if (a7) {
      const g = masGrado(), n = 7 + 2 * f + 2 * g;
      if (!a7.xs) {
        a7.xs = [clamp(F.x + azar(-4, 4), 8, W - 8)];
        for (let tries = 0; a7.xs.length < n && tries < 300; tries++) { const x = azar(8, W - 8); if (a7.xs.every(o => Math.abs(o - x) > 14)) a7.xs.push(x); }
        a7.k = 0; musica.sfx.ancla();
      }
      if (a7.k < a7.xs.length && a7.t > 0.5 + a7.k * 0.12) {
        lista.push({ x0: jefe.x, y0: jefe.y + 10, x: jefe.x, y: jefe.y + 10, tx: a7.xs[a7.k++], t: 0, dur: azar(1.2, 1.6) - 0.05 * g, alto: azar(40, 70) });
        musica.sfx.roce(jefe.x);
      }
      if (a7.k >= a7.xs.length && a7.t > 0.7 + a7.xs.length * 0.12) jefe.ataque = null;
    }
    for (let i = lista.length - 1; i >= 0; i--) {
      const m = lista[i];
      m.t += dt;
      const q = Math.min(1, m.t / m.dur);
      m.x = lerp(m.x0, m.tx, q); m.y = lerp(m.y0, Y_AGUA - 2, q) - m.alto * 4 * q * (1 - q);
      if (m.t < m.dur) continue;
      lista.splice(i, 1);
      const casco = naufragioEn(m.tx, M.Y_NAUFRAGIOS + 2);
      if (casco) { erosiona(casco.n, casco.lx, casco.ly, 2); chispas(m.tx, M.Y_NAUFRAGIOS, 6, ["#ffd070", "#b87828"], 30, 0.4); musica.sfx.escudo(); continue; }
      chispas(m.tx, Y_AGUA - 2, 8, ["#ffd070", "#fff0b0", "#8fd8ff"], 40, 0.5); musica.sfx.roce(m.tx);
      if (estado === "juego" && Math.abs(F.x - m.tx) < 7) golpeFanal("moneda");
    }
  }

  /* La Crisálida. COSTURA: una aguja de oro cose el agua de una orilla a
     la otra (desde la que está lejos de ti). Pica en puntadas parejas,
     cada una marcada un momento antes; no se la puede esquivar quedándose
     quieto: hay que cruzarla justo después de una puntada. Un casco recibe
     la puntada por ti (y se rompe un poco). */
  const PASO_COSTURA = 16;
  function esp7Crisalida(dt, a7, f) {
    jefe.aguja = null;
    if (!a7) return;
    const g = masGrado(), pasadas = 1 + (f === 2 ? 1 : 0) + (g >= 2 ? 1 : 0), n = Math.floor((W - 8) / PASO_COSTURA) + 1;
    const cada = Math.max(0.2, 0.3 - 0.02 * f - 0.02 * g), aviso = 0.6, t0 = 0.4 + aviso, total = pasadas * n;
    if (a7.dir == null) { a7.dir = F.x < W / 2 ? -1 : 1; a7.picadas = new Set(); musica.sfx.barrido(1); }
    const xDe = j => { const pasada = Math.floor(j / n), i = j % n, dir = pasada % 2 ? -a7.dir : a7.dir; return 4 + (dir > 0 ? i : n - 1 - i) * PASO_COSTURA; };
    const s = (a7.t - t0) / cada, j = Math.floor(s);
    // Las puntadas marcadas (las que vienen), la que pica ahora y lo ya cosido.
    const marcas = [];
    for (let m = Math.max(0, j + 1); m < total && m <= j + Math.ceil(aviso / cada); m++) marcas.push(xDe(m));
    const hecho = Math.max(0, Math.min(total, j + 1)), cosido = [];
    for (let m = Math.max(0, hecho - n); m < hecho; m++) cosido.push(xDe(m));
    let ax = xDe(0), ay = 200;
    if (s >= 0 && j < total) { const fr = s - j, x1 = xDe(j), x2 = xDe(Math.min(total - 1, j + 1)); ax = lerp(x1, x2, fr); ay = Y_AGUA - 2 - 50 * Math.sin(Math.PI * fr); }
    else if (s < 0) { ax = xDe(0); ay = lerp(jefe.y, Y_AGUA - 52, clamp(a7.t / t0, 0, 1)); }
    jefe.aguja = { x: ax, y: ay, marcas, cosido, fin: j >= total };
    if (j >= 0 && j < total && s - j < 0.12 / cada && !a7.picadas.has(j)) {
      a7.picadas.add(j);
      const x = xDe(j), casco = naufragioEn(x, M.Y_NAUFRAGIOS + 2);
      chispas(x, Y_AGUA - 1, 4, ["#ffd070", "#fff0b0"], 26, 0.3); musica.sfx.roce(x);
      if (casco) erosiona(casco.n, casco.lx, casco.ly, 2);
      else if (estado === "juego" && Math.abs(F.x - x) < 8 && !naufragioEn(F.x, M.Y_NAUFRAGIOS + 2)) golpeFanal("costura");
    }
    if (a7.t > t0 + total * cada + 0.3) jefe.ataque = null;
  }

  /* La Hoguera. ORO FUNDIDO: deja caer gotas de oro (una sobre ti), con
     su sombra en el agua; al caer se abren en charcos que queman un rato y
     después se enfrían. Una gota que cae en un casco lo quema. */
  function esp7Hoguera(dt, a7, f) {
    const lista = jefe.charcosOro || (jefe.charcosOro = []);
    if (a7) {
      const g = masGrado(), n = 3 + f + g;
      if (!a7.xs) {
        a7.xs = [clamp(F.x + azar(-6, 6), 10, W - 10)];
        for (let tries = 0; a7.xs.length < n && tries < 300; tries++) { const x = azar(10, W - 10); if (a7.xs.every(o => Math.abs(o - x) > 34)) a7.xs.push(x); }
        a7.k = 0; musica.sfx.llamarada(1);
      }
      if (a7.k < a7.xs.length && a7.t > 0.4 + a7.k * 0.3) lista.push({ x: a7.xs[a7.k++], x0: jefe.x, y0: jefe.y + 20, t: -1, w: 0, wMax: 11 + 2 * f + g, dur: 4 + f + g });
      if (a7.k >= a7.xs.length && a7.t > 0.6 + a7.xs.length * 0.3) jefe.ataque = null;
    }
    for (let i = lista.length - 1; i >= 0; i--) {
      const c = lista[i];
      c.t += dt;
      if (c.t < 0) continue;                                              // todavía cae
      if (!c.cayo) {
        c.cayo = true;
        const casco = naufragioEn(c.x, M.Y_NAUFRAGIOS + 2);
        if (casco) { erosiona(casco.n, casco.lx, casco.ly, 4); chispas(c.x, M.Y_NAUFRAGIOS, 10, ["#ffd070", "#ff8c3c"], 40, 0.5); musica.sfx.escudo(); lista.splice(i, 1); continue; }
        chispas(c.x, Y_AGUA, 12, ["#ffd070", "#ff8c3c", "#fff0b0"], 50, 0.5); musica.sfx.escudo();
      }
      c.w = c.wMax * Math.min(1, c.t / 0.6);
      if (c.t < c.dur - 0.6 && estado === "juego" && Math.abs(F.x - c.x) < c.w) golpeFanal("oro");
      if (c.t > c.dur) lista.splice(i, 1);
    }
  }

  /* La Luna. HALO: se rodea de un anillo de escamas de oro (con un hueco),
     lo deja titilar sobre ti y lo suelta: caen todas a la vez, así que el
     anillo llega al agua como una figura que se abre desde el centro. */
  function esp7Luna(dt, a7, f) {
    if (!a7) return;
    const g = masGrado(), anillos = 1 + (f >= 1 ? 1 : 0) + (g >= 2 ? 1 : 0);
    a7.k = a7.k || 0;
    if (a7.k < anillos && a7.t > 0.4 + a7.k * 1.1) {
      const cx = a7.k === 0 ? clamp(F.x, 44, W - 44) : clamp(F.x + azar(-60, 60), 44, W - 44), cy = 118, r = 40 + 5 * g, n = 16, hueco = Math.floor(Math.random() * n);
      for (let i = 0; i < n; i++) {
        if (i === hueco || i === (hueco + 1) % n) continue;
        const a = (i / n) * Math.PI * 2;
        escamas.push(nuevaEscama(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0, 82 + 6 * f + 6 * g, { jefe: true, halo: true, espera: 1.1 }));
      }
      a7.k++; musica.sfx.eclipse(); anillo(cx, cy, "#ffd070", r);
    }
    if (a7.k >= anillos && a7.t > 0.6 + anillos * 1.1) jefe.ataque = null;
  }

  /* Las Siete Hermanas. GRIETAS DEL CIELO: el cielo se raja entre algunas
     de ellas (las grietas se marcan y las siguen mientras giran) y por cada
     grieta se derrama una fila de escamas de oro, que cae. */
  function esp7Constelacion(dt, a7, f) {
    jefe.grietas = null;
    if (!a7) return;
    const g = masGrado(), AVISO = 0.9;
    if (!a7.pares) {
      const hs = jefe.hermanas, n = Math.min(6, 3 + f + g), pares = [], vistos = new Set();
      for (let tries = 0; pares.length < n && tries < 100; tries++) {
        const a = Math.floor(Math.random() * hs.length), b = Math.floor(Math.random() * hs.length), clave = Math.min(a, b) + "-" + Math.max(a, b);
        if (a === b || vistos.has(clave)) continue;
        vistos.add(clave); pares.push([hs[a], hs[b]]);
      }
      a7.pares = pares; musica.sfx.escudo();
    }
    if (a7.t < AVISO) jefe.grietas = a7.pares.map(([a, b]) => [posHermana(a), posHermana(b)]);
    else if (!a7.hecho) {
      a7.hecho = 1; relampago("#fff0b0", 0.2); musica.sfx.barrido(0.6);
      for (const [a, b] of a7.pares) {
        const p = posHermana(a), q = posHermana(b), n = Math.max(2, Math.round(Math.hypot(q.x - p.x, q.y - p.y) / 9));
        for (let i = 0; i <= n; i++) escamas.push(nuevaEscama(lerp(p.x, q.x, i / n), lerp(p.y, q.y, i / n), 0, 64 + 6 * f + 6 * g, { jefe: true, oro: true, espera: 0.15 + (i / n) * 0.35 }));
      }
    }
    if (a7.t > AVISO + 0.6) jefe.ataque = null;
  }

  /* El Sol. FULGOR: una ola de luz de oro cruza el agua de una orilla a la
     otra. Lo único que no quema es su sombra, marcada antes en el agua (y
     lejos de donde estás), o un casco encima. */
  function esp7Sol(dt, a7, f) {
    jefe.fulgor = null;
    if (!a7) return;
    const g = masGrado(), ancho = 54 + 6 * f + 6 * g, v = 80 + 8 * f + 8 * g, hueco = Math.max(13, 18 - 2 * g), aviso = 1.1;
    if (a7.dir == null) {
      a7.dir = F.x < W / 2 ? 1 : -1;                                      // entra por tu lado
      let x = azar(hueco + 4, W - hueco - 4);
      for (let tries = 0; tries < 50 && Math.abs(x - F.x) < 50; tries++) x = azar(hueco + 4, W - hueco - 4);
      a7.sombra = x; musica.sfx.llamarada(1);
    }
    const dur = (W + ancho) / v, d = Math.max(0, a7.t - aviso) * v;
    const x0 = a7.dir > 0 ? -ancho + d : W - d, x1 = x0 + ancho;           // lo que cubre la ola ahora
    jefe.fulgor = { x0, x1, on: a7.t >= aviso, sombra: a7.sombra, hueco, dir: a7.dir };
    if (a7.t >= aviso && estado === "juego" && F.x > x0 && F.x < x1 && Math.abs(F.x - a7.sombra) > hueco && !naufragioEn(F.x, M.Y_NAUFRAGIOS + 2)) golpeFanal("fulgor");
    if (a7.t > aviso + dur) jefe.ataque = null;
  }
  const ESPECIALES7 = { nodriza: esp7Nodriza, faro: esp7Faro, esfinge: esp7Esfinge, casco: esp7Casco, crisalida: esp7Crisalida, hoguera: esp7Hoguera, luna: esp7Luna, constelacion: esp7Constelacion, sol: esp7Sol };

  /* Lo que las habilidades de la fase 7 ponen en pantalla (las hojas, el
     halo y lo que derraman las grietas son escamas: dibujaEscamas). */
  const OROS = ["#ffd070", "#e8a83c", "#fff0b0", "#b87828"];
  function dibujaFase7() {
    const t = jefe.tipo;
    if (t === "faro" && jefe.grieta) {
      const gr = jefe.grieta, y0 = Math.floor(jefe.y + 8);
      if (!gr.on) {
        lx.fillStyle = "#fff0b0";
        for (let y = y0; y < H; y += 6) { lx.globalAlpha = 0.6; lx.fillRect(Math.floor(gr.x) - 7, y, 1, 3); lx.fillRect(Math.floor(gr.x) + 7, y, 1, 3); }
        lx.globalAlpha = 1;
      } else for (const s of gr.d < 1 ? [0] : [-1, 1]) {
        const x = Math.floor(gr.x + s * gr.d);
        if (x < -4 || x > W + 4) continue;
        let yFin = H;
        for (let y = y0; y < H; y += 2) if (naufragioEn(x, y)) { yFin = y; break; }   // un casco corta el haz
        for (let y = y0; y < yFin; y += 2) { ex.fillStyle = (y + Math.floor(tMusica * 60)) % 6 < 3 ? "#ffd070" : "#fff0b0"; ex.fillRect(x - 3 + Math.round(Math.sin(y * 0.25 + tMusica * 18)), y, 7, 2); }
        ex.fillStyle = "#ffffff"; ex.fillRect(x, y0, 1, yFin - y0);
      }
    }
    if (t === "esfinge" && jefe.calices) {
      const c = jefe.calices;
      if (c.malos) for (const s of c.malos) {
        const x0 = Math.floor(X_CALIZ[s] - W / 6 + 2), ancho = Math.floor(W / 3 - 4);
        if (c.on) { lx.fillStyle = "#ffd070"; lx.globalAlpha = 0.55; lx.fillRect(x0, Y_CALIZ + 6, ancho, H - Y_CALIZ - 6); lx.globalAlpha = 1; for (let y = Y_CALIZ + 6; y < H; y += 3) { ex.fillStyle = (y + Math.floor(tMusica * 50)) % 6 < 3 ? "#ffb040" : "#fff0b0"; ex.fillRect(x0 + ((y * 7) % 11), y, ancho - 11, 1); } }
        else { lx.fillStyle = "#ffd070"; for (let y = Y_CALIZ + 8; y < H; y += 6) { lx.globalAlpha = 0.5; lx.fillRect(x0, y, 1, 3); lx.fillRect(x0 + ancho - 1, y, 1, 3); } lx.globalAlpha = 1; }
      }
      for (let k = 0; k < 3; k++) {
        const x = Math.floor(c.xs[k]), y = Math.floor(c.ys[k] - c.alza * 9);
        if (k === c.luz && c.alza > 0.2) { brillo(x, Y_CALIZ + 6, 16, "#fff6d8", 0.9 * c.alza); ex.fillStyle = "#ffffff"; ex.fillRect(x - 1, Y_CALIZ + 3, 3, 4); }
        // El cáliz: copa, tallo y pie.
        ex.fillStyle = "#3a2410"; ex.fillRect(x - 6, y - 8, 13, 7); ex.fillRect(x - 1, y - 1, 3, 4); ex.fillRect(x - 4, y + 3, 9, 2);
        ex.fillStyle = "#e8a83c"; ex.fillRect(x - 5, y - 7, 11, 5); ex.fillRect(x, y - 2, 1, 4); ex.fillRect(x - 3, y + 3, 7, 1);
        ex.fillStyle = "#fff0b0"; ex.fillRect(x - 4, y - 7, 2, 4); ex.fillRect(x - 5, y - 8, 11, 1);
      }
    }
    if (t === "casco") for (const m of jefe.monedas || []) {
      const urge = m.t > m.dur - 0.4 && Math.floor(tMusica * 14) & 1;
      lx.fillStyle = urge ? "#ffffff" : "#ffd070";
      for (let dx = -6; dx <= 6; dx += 3) { lx.globalAlpha = 0.55; lx.fillRect(Math.floor(m.tx + dx), Y_AGUA + 2, 2, 1); }
      lx.globalAlpha = 1;
      const x = Math.floor(m.x), y = Math.floor(m.y), ancho = Math.floor(m.t * 10) % 3 === 1 ? 1 : 3;
      ex.fillStyle = "#b87828"; ex.fillRect(x - Math.floor(ancho / 2), y - 1, ancho, 3);
      ex.fillStyle = "#fff0b0"; ex.fillRect(x, y - 1, 1, 1);
      brillo(m.x, m.y, 6, "#ffd070", 0.4);
    }
    if (t === "crisalida" && jefe.aguja) {
      const a = jefe.aguja;
      lx.fillStyle = "#fff0b0";
      for (const x of a.marcas) for (let y = 230; y < H; y += 6) { lx.globalAlpha = 0.55; lx.fillRect(Math.floor(x), y, 1, 3); }
      lx.globalAlpha = 1;
      // Lo cosido: puntadas de oro sobre el agua.
      ex.fillStyle = "#e8a83c";
      for (const x of a.cosido) { ex.fillRect(Math.floor(x) - 5, Y_AGUA - 1, 4, 1); ex.fillRect(Math.floor(x) + 2, Y_AGUA + 1, 4, 1); }
      if (!a.fin) {
        const x = Math.floor(a.x), y = Math.floor(a.y);
        ex.fillStyle = "#b87828"; ex.fillRect(x - 1, y - 12, 3, 12);
        ex.fillStyle = "#fff0b0"; ex.fillRect(x, y - 12, 1, 13); ex.fillRect(x, y - 15, 1, 2);
        ex.fillStyle = "#ffd070"; ex.fillRect(x - 1, y - 16, 3, 1);           // el ojo de la aguja
        lx.fillStyle = "#ffd070"; lx.globalAlpha = 0.5;                         // el hilo, hasta la Crisálida
        const n = 24;
        for (let i = 0; i <= n; i++) lx.fillRect(Math.floor(lerp(x, jefe.x, i / n)), Math.floor(lerp(y - 15, jefe.y, i / n) + Math.sin(i / n * Math.PI) * 10), 1, 1);
        lx.globalAlpha = 1;
        brillo(a.x, a.y - 6, 10, "#ffd070", 0.5);
      }
    }
    if (t === "hoguera") for (const c of jefe.charcosOro || []) {
      if (c.t < 0) {
        const q = 1 + c.t, x = Math.floor(lerp(c.x0, c.x, q)), y = Math.floor(lerp(c.y0, Y_AGUA, q * q));
        ex.fillStyle = "#ff8c3c"; ex.fillRect(x - 1, y - 2, 3, 4); ex.fillStyle = "#fff0b0"; ex.fillRect(x, y - 2, 1, 2);
        lx.fillStyle = "#ffd070"; lx.globalAlpha = 0.25 + 0.45 * q; lx.fillRect(Math.floor(c.x) - 6, Y_AGUA + 2, 13, 1); lx.globalAlpha = 1;
        continue;
      }
      const frio = c.t > c.dur - 0.6, x = Math.floor(c.x), w = Math.max(1, Math.round(c.w));
      ex.fillStyle = frio ? "#5a3a1c" : "#b87828"; ex.fillRect(x - w, Y_AGUA - 1, w * 2 + 1, 3);
      if (!frio) {
        ex.fillStyle = "#ffd070"; ex.fillRect(x - w + 2, Y_AGUA - 1, Math.max(1, w * 2 - 3), 1);
        ex.fillStyle = "#fff0b0"; ex.fillRect(x - 2 + Math.round(Math.sin(tMusica * 9 + c.x) * (w - 3)), Y_AGUA - 1, 2, 1);
        if (Math.random() < 0.08) chispas(c.x + azar(-w, w), Y_AGUA - 2, 1, ["#ffd070", "#ff8c3c"], 20, 0.4);
      }
    }
    if (t === "constelacion" && jefe.grietas) for (const [p, q] of jefe.grietas) {
      linea(lx, p, q, "#fff0b0", 0.75);
      linea(ex, { x: p.x, y: p.y + 1 }, { x: q.x, y: q.y + 1 }, "#e8a83c", 0.8);
    }
    if (t === "sol" && jefe.fulgor) {
      const fu = jefe.fulgor, s0 = Math.floor(fu.sombra - fu.hueco), s1 = Math.floor(fu.sombra + fu.hueco);
      // La sombra marcada en el agua: un disco oscuro, achatado.
      ex.fillStyle = "#1a1028"; ex.fillRect(s0 + 3, Y_AGUA, s1 - s0 - 5, 2); ex.fillRect(s0 + 1, Y_AGUA + 2, s1 - s0 - 1, 2);
      lx.fillStyle = "#ffd070";
      for (let y = 220; y < H; y += 6) { lx.globalAlpha = 0.5; lx.fillRect(s0, y, 1, 3); lx.fillRect(s1, y, 1, 3); }
      lx.globalAlpha = 1;
      if (!fu.on) {   // por dónde entra: flechas en esa orilla
        const xb = fu.dir > 0 ? 4 : W - 5;
        if (Math.floor(tMusica * 6) & 1) for (let y = 236; y < H; y += 14) { ex.fillStyle = "#ffd070"; ex.fillRect(xb, y, 1, 5); ex.fillRect(xb + fu.dir, y + 1, 1, 3); ex.fillRect(xb + 2 * fu.dir, y + 2, 1, 1); }
      } else {
        for (const [a, b] of [[fu.x0, Math.min(fu.x1, s0)], [Math.max(fu.x0, s1), fu.x1]]) {
          const xa = Math.max(0, Math.floor(a)), xb = Math.min(W, Math.ceil(b));
          if (xb <= xa) continue;
          lx.fillStyle = "#ffd070"; lx.globalAlpha = 0.45; lx.fillRect(xa, 200, xb - xa, H - 200); lx.globalAlpha = 1;
          for (let y = 206; y < H; y += 4) { ex.fillStyle = (y + Math.floor(tMusica * 40)) % 8 < 4 ? "#ffb040" : "#fff0b0"; ex.fillRect(xa + ((y * 5) % 7), y, Math.max(0, xb - xa - 7), 1); }
        }
      }
    }
  }

  const ESPECIALES = { nodriza: espNodriza, faro: espFaro, esfinge: espEsfinge, casco: espCasco, crisalida: espCrisalida, hoguera: espHoguera, luna: espLuna, constelacion: espConstelacion, sol: espSol };

  /* Las nubes de ceniza: si alcanzan el fanal, la llama se ahoga un
     momento (la luz se achica), sin quitar ninguna llama. */
  function actualizaCenizas(dt) {
    for (let i = cenizas.length - 1; i >= 0; i--) {
      const c = cenizas[i];
      c.t += dt; c.y += c.vy * dt; c.x += Math.sin(c.t * 1.3) * 5 * dt;
      if (estado === "juego" && Math.abs(c.x - F.x) < c.r + 5 && Math.abs(c.y - (M.Y_FANAL - 4)) < c.r) {
        fx.eclipseObj = Math.min(fx.eclipseObj, 0.6); fx.cenizaT = 1.8;
        chispas(c.x, c.y, 10, ["#5a5068", "#7a7088"], 20, 0.8, "humo");
        cenizas.splice(i, 1); continue;
      }
      if (c.y > H + 12) cenizas.splice(i, 1);
    }
    if (fx.cenizaT > 0) { fx.cenizaT -= dt; if (fx.cenizaT <= 0 && !(jefe && jefe.ataque && jefe.ataque.nombre === "eclipse")) fx.eclipseObj = 1; }
  }
  function actualizaSombras(dt) {
    for (let i = sombras.length - 1; i >= 0; i--) {
      const s = sombras[i];
      if (!s.viva || s.x < -20 || s.x > W + 20) { sombras.splice(i, 1); continue; }
      s.t += dt;
      s.x += s.vx * dt;
      s.y += (Math.sin(s.t * 2.4 + s.f) * 18 + clamp((M.Y_FANAL - 10 - s.y) * 0.25, -8, 14)) * dt;
      if (estado === "juego" && Math.abs(s.x - F.x) < 7 && Math.abs(s.y - (M.Y_FANAL - 3)) < 6) { s.viva = false; golpeFanal("sombra"); }
    }
  }

  function muereJefe() {
    jefe.muerto = 0.001; jefe.vida = 0;
    escamas = escamas.filter(e => !e.jefe);
    larvas.forEach(l => (l.vida = 0));
    hilos = [];
    fx.eclipseObj = 1; F.viento = 0;
    anota("j");
    suma(M.PUNTOS_JEFE[jefe.tipo] * (P.j.vuelta ? 1 + 0.25 * P.j.vuelta : 1), jefe.x, jefe.y, true);
    sacude(0.7); relampago("#fff6d8", 0.6); fx.aberr = 0.4;
    chispas(jefe.x, jefe.y, 90, ["#fff6d8", "#ffd27a", S.PALETAS[actoVisual(P.j)].acento], 90, 1.6, "polvo");
    destella(jefe.x, jefe.y, 80, 1, 1.2);
    musica.sfx.muerte(jefe.x, 0, true); musica.sfx.cruce();
    $("jefeBarra").hidden = true;
    musica.estado({ jefe: null });
    apagaEstrella();
    anclas = []; columnas = []; jefe.marcaX = null; jefe.marcasHilo = null; jefe.trazo = null; jefe.pistaAng = null; jefe.eclipse = null;
    // Lo que dejaron sus habilidades de fase se va con él.
    jefe.balizas = []; jefe.charcos = []; jefe.red = null; jefe.redAviso = null; jefe.espejos = null; jefe.fatuo = null; jefe.sinLlama = false;
    jefe.seda = 0; jefe.tizones = null; jefe.canicula = 0; jefe.resaca = 0; jefe.colapso = 1; jefe.haz = null; jefe.pista = null;
    for (const h of jefe.hermanas || []) h.nova = null;
    for (const o of jefe.orbita || []) o.lanz = null;
    F.calor = 0; F.mudo = 0;
    // Y lo de la fase 4.
    jefe.reclamo = null; jefe.deslumbre = null; jefe.sombra = null; jefe.balasR = []; jefe.mortaja = null; jefe.cerco = null;
    jefe.horizonte = 0; jefe.horizonteAviso = false; jefe.ronda = 0; jefe.punta = null; jefe.ocaso = null; F.capullo = 0;
    jefe.acertijo = null; jefe.acertijoGolpe = 0; jefe.escora = null; jefe.compas = null; jefe.yesca = []; jefe.rayoLuna = null; jefe.aurora = null; jefe.amanecer = null; F.posadas = 0;
    // Y lo de la fase 6.
    jefe.muda = null; jefe.calei = null; jefe.esquirlas = []; jefe.botellas = []; jefe.vidriera = []; jefe.colada = null; jefe.aguaVidrio = 0; jefe.lupa = null;
    // Y lo de la fase 7.
    jefe.grieta = null; jefe.calices = null; jefe.monedas = []; jefe.aguja = null; jefe.charcosOro = []; jefe.grietas = null; jefe.fulgor = null;
    if (jefe.tipo === "faro" && enHistoria()) programa(revelacion, 1.4);
    else if (jefe.tipo === "esfinge" && enHistoria()) { apagaTodas(); programa(terminaJornada, 3.6); }
    else if (jefe.tipo === "hoguera" && enHistoria()) programa(finalHoguera, 2.6);
    else if (jefe.tipo === "sol" && enHistoria()) programa(finalSol, 2.6);
    else programa(terminaJornada, 2.2);
  }
  /* Al morir la Esfinge se apagan las estrellas que quedan: en el cielo no
     hay más luz que la tuya. */
  function apagaTodas() {
    const vivas = cielo.estrellas.filter(e => e.viva && !e.muere);
    vivas.forEach((e, i) => programa(() => { e.muere = 0.8; }, (i / Math.max(1, vivas.length)) * 2.6));
    programa(() => { P.luces = 1; pintaHud(true); }, 2.8);
  }

  /* ================================================================
     El alba: las lumbres (jornada 12)
     ================================================================ */
  function empiezaLumbres() {
    lumbres = Array.from({ length: 24 }, (_, i) => ({ a: (i / 24) * Math.PI * 2 + Math.random() * 0.2, r: azar(150, 210), w: azar(0.35, 0.7) * (i % 2 ? 1 : -1), vr: azar(3.2, 5), viva: true, f: Math.random() * 6, x: 0, y: 0 }));
  }
  function actualizaLumbres(dt) {
    for (const l of lumbres) {
      if (!l.viva) continue;
      l.a += l.w * dt; l.r = Math.max(0, l.r - l.vr * dt * (l.r < 50 ? 1.6 : 1));
      const cx = F.x, cy = M.Y_FANAL - 46;
      l.x = cx + Math.cos(l.a) * l.r; l.y = cy + Math.sin(l.a) * l.r * 0.62 + Math.sin(tMusica * 2 + l.f) * 3;
      if (Math.hypot(l.x - F.x, l.y - (M.Y_FANAL - 6)) < 9 || l.r < 4) {   // llega a tu luz y se queda
        l.viva = false; P.acogidas++; F.radioExtra += 1.6; anota("q");
        musica.sfx.nota(P.acogidas % 7, 2, 0.06); anillo(F.x, M.Y_FANAL - 6, "#fff6d8", 12);
      }
    }
    if (estado === "juego" && lumbres.length && !lumbres.some(l => l.viva) && !P.terminando) { P.terminando = 1; programa(terminaJornada, 1.5); }
  }

  /* ================================================================
     Flujo: jornadas, tránsitos, revelación, final, fin
     ================================================================ */
  function limpiaEntidades() {
    polillas = []; balas = []; escamas = []; poderes = []; larvas = []; lumbres = []; sombras = []; cenizas = []; msj = null; jefe = null;
    hilos = []; anclas = []; columnas = []; luciernagas = luciernagas.filter(l => !l.libre);
    $("jefeBarra").hidden = true; fx.eclipseObj = 1; F.viento = 0; F.calor = 0; F.mudo = 0; F.capullo = 0; F.posadas = 0;
  }
  function iniciaJornada(n) {
    const j = M.jornada(n);
    P.jornada = n; P.j = j; P.acto = j.acto === 5 ? 5 : j.acto;
    P.sinDanio = true; P.disparosJ = 0; P.aciertosJ = 0; P.fragJ = []; P.ecoJ = []; P.ecoMostrar = null; P.terminando = 0;
    P.fuegoAcum = 0; P.picadaAcum = 0; P.msjK = 0;
    limpiaEntidades();
    naufragios = j.tipo === "lumbre" || j.jefe === "alba" ? [] : creaNaufragios(actoVisual(j), j.cascos || (j.jefe === "casco" ? 6 : 0));
    // Lo que trae el fanal desde el taller.
    const N = naveF();
    if (N.campana) F.campana = 1;
    F.campanaT = 0; F.enredo = 0; F.pulsoT = 0;
    P.hiloAcum = 0;
    if (j.tipo === "oleada") { empiezaOleada(j); P.mensajerasRest = j.mensajeras; P.tMensajera = j.mensajeras > 2 ? azar(6, 10) : azar(9, 17); }
    else if (j.tipo === "lumbre") { empiezaLumbres(); P.mensajerasRest = j.mensajeras; P.tMensajera = azar(5, 9); }
    else { empiezaJefe(j); P.mensajerasRest = 0; }                    // la Mensajera de la oleada anterior no cruza el jefe
    if (j.tipo === "lumbre") programa(() => musica.estado({ modo: "transito" }), 0.05); // nadie dispara: la música tampoco
    estado = "juego";
    musica.estado({ modo: "juego", jefe: j.tipo === "jefe" ? j.jefe : null, vida: 1, tension: 0, peligro: 0, latido: 1, cerca: 0, fase: j.fase || 1 });   // la fase mueve la energía de la música
    cielo.velObj = 4;
    $("hudSup").hidden = false;
    pintaHud(true);
    lienzo.focus({ preventScroll: true });
    P.uJ = P.uSig;                                                     // regAbre lo vacía
    regAbre(n);
    P.llamasJ0 = P.llamas; P.puntosJ0 = P.puntos; P.notasJ0 = P.notas; P.lucesJ0 = P.luces;
    // Una travesía retomada vuelve a la jornada desde el principio, pero las
    // llamas que ya había perdido en ella siguen perdidas (y en la prueba).
    let perdidas = P.perdidasPend;
    P.perdidasPend = 0;
    while (perdidas-- > 0 && P.llamas > 0) { P.llamas--; P.notas = 0; P.sinDanio = false; P.stats.danios++; anota("g"); }
    pintaLlamas();
    if (P.llamas <= 0) { apagaFanal(); return; }
    guardaPunto(n);
  }
  function terminaJornada() {
    if (!P || estado === "fin" || estado === "muriendo") return;
    const b = M.bonusJornada({ acto: P.j.acto, sinDanio: P.sinDanio, disparos: P.disparosJ, aciertos: P.aciertosJ });
    const conBonus = P.j.tipo !== "lumbre" && P.j.jefe !== "alba";
    if (conBonus) suma(b.total);
    P.completadas = Math.max(P.completadas, P.jornada);
    if (P.j.tipo === "jefe") P.brasas++;                               // solo vencer a un jefe da una brasa para el taller
    if (P.j.tipo === "lumbre") P.piedadJ = P.apagadasLumbre === 0;
    regCierra("c");
    // Las cartas leídas en la jornada quedan en la bitácora para siempre.
    if (P.fragJ.length || P.ecoJ.length) { prog.frag = [...new Set([...prog.frag, ...P.fragJ])].sort((a, c) => a - c); prog.ecos = [...new Set([...prog.ecos, ...P.ecoJ])].sort((a, c) => a - c); guardaProgreso(); }
    transito(P.jornada + 1, conBonus ? b : null);
  }

  /* El tránsito: se rema hacia la próxima jornada. Se lee la bitácora, las
     cartas recuperadas y, si cambia el acto, su nombre. */
  let relatoListo = 0, relatoSigue = null, relatoAuto = 0;
  function transito(nSig, bonus) {
    estado = "relato";
    const jSig = M.jornada(nSig), actoSig = actoVisual(jSig), cambia = actoSig !== cielo.hacia;
    balas = []; escamas = []; poderes = []; msj = null;
    cielo.velObj = 46;
    if (cambia) {
      cielo.desde = cielo.hacia; cielo.hacia = actoSig; cielo.mezcla = 0;
      document.documentElement.dataset.acto = actoSig;
      musica.enmudece(1.4);
      programa(() => { musica.ponEtapa(etapaMusical(jSig), true); if (estado === "relato") musica.estado({ modo: "transito", jefe: null }); }, 1.5);
      if (actoSig >= 5) cielo.estrellas = cielo.estrellas.concat(creaEstrellas(30, nSig)).slice(-260);
      // El firmamento: vuelven las estrellas que apagaste (las cartas lo
      // dicen: «subieron»). El cielo se llena, y el contador con él.
      if (actoSig === 10) {
        const n = 180;
        const nuevas = creaEstrellas(n, 1010 + nSig);
        for (const e of nuevas) { e.nace = 1; e.y *= 0.8; }
        cielo.estrellas = cielo.estrellas.concat(nuevas).slice(-360);
        if (P) P.luces += n;
      }
    } else {
      if (jSig.acto === 5) musica.ponEtapa(etapaMusical(jSig));
      musica.estado({ modo: "transito", jefe: null });
    }
    // La travesía queda guardada al empezar el tránsito: si se cierra la
    // página, «Seguir la travesía» vuelve aquí (ver guardaPunto).
    P.llamasJ0 = P.llamas; P.puntosJ0 = P.puntos; P.notasJ0 = P.notas; P.lucesJ0 = P.luces; P.uJ = P.uSig;
    guardaPunto(nSig);
    const lineas = [];
    // En el sin fin, cada acto que vuelve se presenta con su fase.
    const cartel = cambia || (jSig.acto === 5 && jSig.tipo === "oleada");
    if (cartel) {
      const a = R.actoInfo(jSig.acto === 5 ? jSig.actoBase : jSig.acto);
      const parte = nSig === M.JORNADA_ALBA + 1 ? R.PARTE_DOS.num + " · " : nSig === M.JORNADA_HOGUERA + 1 && R.PARTE_TRES ? R.PARTE_TRES.num + " · " : "";
      const num = jSig.acto === 5 ? "FASE " + R.romano(jSig.fase || 2) + gradoTexto(jSig) + (jSig.vuelta ? " · VUELTA " + (jSig.vuelta + 1) : "") : parte + "ACTO " + M.ROMANO_ACTO[jSig.acto];
      ponActo(num, a.nombre, a.lema);
    } else ponActo("", "", "");
    const caido = P.jornada && P.j && P.j.tipo === "jefe" && R.JEFES[P.j.jefe] && P.jornada <= M.JORNADAS_HISTORIA ? R.JEFES[P.j.jefe].cae : "";
    if (caido) lineas.push({ t: caido });
    lineas.push({ t: R.bitacora(nSig), cls: "bitacora" });
    if (jSig.jefe === "alba") lineas.push({ t: R.AVISO_ALBA, cls: "grande" });
    if (jSig.jefe === "hoguera" && nSig <= M.JORNADAS_HISTORIA) lineas.push({ t: R.AVISO_HOGUERA, cls: "grande" });
    if (jSig.jefe === "sol" && nSig <= M.JORNADAS_HISTORIA && R.AVISO_SOL) lineas.push({ t: R.AVISO_SOL, cls: "grande" });
    // Una fase con anuncio propio (la 7), la primera vez que llega.
    const fAntes = P.j ? P.j.fase || 0 : 0;
    if (jSig.fase > fAntes && R.FASE_NUEVA && R.FASE_NUEVA[jSig.fase]) { lineas.push({ t: R.FASE_NUEVA[jSig.fase].t, cls: "grande" }); lineas.push({ t: R.FASE_NUEVA[jSig.fase].nota, cls: "augurio" }); }
    // El rigor desde la fase 6: se dice al empezar cada vuelta.
    const gAntes = P.j ? P.j.grado || 0 : 0;
    if (jSig.grado > gAntes) { lineas.push({ t: jSig.grado === 1 ? R.RIGOR.primera : R.RIGOR.otra(jSig.grado), cls: "grande" }); lineas.push({ t: R.RIGOR.nota, cls: "augurio" }); }
    // El augurio: lo que la noche aprendió para esta jornada.
    const aug = M.augurioDe(nSig);
    if (aug) lineas.push({ t: R.AUGURIO_PRE + " " + R.AUGURIOS[aug].toLowerCase(), cls: "augurio" });
    const cartas = P.fragJ.length ? P.fragJ.map(i => ({ n: R.romano(i + 1), t: R.FRAGMENTOS[i].texto })) : P.ecoMostrar != null ? [{ n: "~", t: R.ECOS[P.ecoMostrar] }] : [];
    $("capaRelato").classList.add("transito");                         // se ve el cielo pasar mientras se lee
    const brasa = P.brasas > 0 ? `🔥 ${P.brasas} ${P.brasas === 1 ? "BRASA" : "BRASAS"} PARA EL TALLER` : "";
    const textoBonus = [bonus && bonus.total ? `${bonus.sinDanio ? "SIN DAÑO +" + bonus.sinDanio + " · " : ""}PUNTERÍA +${bonus.precision}` : "", brasa].filter(Boolean).join(" · ");
    muestraRelato(lineas, cartas, textoBonus, cartel ? 1.4 : 0.3, 1.2);
    // Después del relato, el taller (si hay brasas); después, a remar.
    relatoSigue = () => (P.brasas > 0 ? abreTaller(() => iniciaJornada(nSig)) : iniciaJornada(nSig));
    relatoAuto = 6 + cartas.length * 4 + (cartel ? 3 : 0);
    pintaHud(true);
  }
  function etapaMusical(j) {
    if (j.acto === 5) return { sinfin: Math.floor((j.n - M.JORNADAS_HISTORIA - 1) / 2) };
    return j.acto;
  }

  /* ================================================================
     El taller: las brasas se gastan en mejoras (motor.js: compra)
     ================================================================
     Se abre en el tránsito, entre el relato y la jornada siguiente. Lo que
     se compra queda en P.uSig y entra en la prueba al abrir la jornada
     (regAbre): el verificador lo vuelve a comprar con la misma función. */
  let tallerSigue = null;
  function abreTaller(despues) {
    estado = "taller"; tallerSigue = despues;
    pintaTaller();
    muestra("capaTaller");
    // El foco va a la caja y no a un botón: quien venía con Espacio apretado
    // desde el relato no compra nada sin querer.
    $("capaTaller").querySelector(".caja").focus({ preventScroll: true });
  }
  function cierraTaller() {
    if (estado !== "taller") return;
    oculta("capaTaller");
    const f = tallerSigue; tallerSigue = null;
    estado = "relato";
    if (f) f();
  }
  function compraTaller(codigo) {
    if (estado !== "taller" || !P) return;
    const est = { mej: P.mej, brasas: P.brasas, llamas: P.llamas };
    const evoA = M.evolucion(P.mej, "arma"), evoN = M.evolucion(P.mej, "nave");
    const no = M.compra(est, codigo);
    if (no) { avisa(no.charAt(0).toUpperCase() + no.slice(1)); musica.sfx.ui(0); return; }
    P.brasas = est.brasas; P.llamas = est.llamas; P.uSig += codigo; P.gastadas++;
    pintaLlamas();
    const k = M.POR_CODIGO[codigo];
    musica.sfx.brasa(k ? P.mej[k] : 1);
    anillo(F.x, M.Y_FANAL - 4, "#ffb060", 16); chispas(F.x, M.Y_FANAL - 8, 10, ["#ffd27a", "#ff9a3c"], 40, 0.6);
    // ¿Evolucionó algo?
    for (const [rama, antes] of [["arma", evoA], ["nave", evoN]]) {
      const ahora = M.evolucion(P.mej, rama);
      if (ahora > antes) {
        const e = R.EVOLUCIONES[rama][ahora];
        avisa("✦ " + (rama === "arma" ? "La llama" : "El fanal") + " evoluciona: " + e.nombre);
        musica.sfx.evolucion(); relampago("#fff0c8", 0.45); sacude(0.2);
        chispas(F.x, M.Y_FANAL - 6, 40, ["#fff6d8", "#ffd27a", "#ff9a3c"], 90, 1.2);
        $("capaTaller").classList.remove("evoluciona"); void $("capaTaller").offsetWidth; $("capaTaller").classList.add("evoluciona");
      }
    }
    pintaTaller();
  }
  /* Pinta el taller: las dos ramas con su evolución, las cuatro mejoras de
     cada una con sus niveles y lo que hará el próximo, y la llama. */
  function pintaTaller() {
    if (!P) return;
    $("tallerBrasas").textContent = P.brasas === 1 ? "1 brasa" : P.brasas + " brasas";
    for (const rama of ["arma", "nave"]) {
      const caja = $(rama === "arma" ? "tallerArma" : "tallerNave");
      caja.replaceChildren();
      const evo = M.evolucion(P.mej, rama), pts = M.puntosRama(P.mej, rama), sig = M.EVOLUCION[evo];
      const h = document.createElement("h3");
      h.textContent = R.RAMAS[rama];
      const ev = document.createElement("p"); ev.className = "evo";
      const nom = document.createElement("b"); nom.textContent = R.EVOLUCIONES[rama][evo].nombre;
      ev.append(nom, document.createTextNode(sig ? ` · evoluciona en ${sig - pts}` : " · forma final"));
      ev.title = R.EVOLUCIONES[rama][evo].d;
      caja.append(h, ev);
      for (const k of M.LISTA_MEJORAS) {
        if (M.MEJORAS[k].rama !== rama) continue;
        const nivel = P.mej[k], max = M.MEJORAS[k].max, info = R.MEJORAS[k];
        const b = document.createElement("button");
        b.type = "button"; b.className = "mejora"; b.dataset.codigo = M.MEJORAS[k].codigo;
        b.disabled = nivel >= max || P.brasas < 1;
        const n = document.createElement("span"); n.className = "nom"; n.textContent = info.nombre;
        const pips = document.createElement("span"); pips.className = "pips"; pips.textContent = "●".repeat(nivel) + "○".repeat(max - nivel);
        const d = document.createElement("span"); d.className = "desc"; d.textContent = nivel >= max ? "Al máximo." : info.d[nivel];
        b.append(n, pips, d);
        caja.appendChild(b);
      }
    }
    const l = $("tallerLlama");
    l.disabled = P.brasas < M.COSTO_LLAMA || P.llamas >= topeLlamas();
    l.querySelector(".desc").textContent = P.llamas >= topeLlamas() ? "Las llamas están llenas (" + P.llamas + ")." : R.LLAMA_TALLER.d + " (" + P.llamas + " de " + topeLlamas() + ")";
    $("tallerSeguir").textContent = P.brasas > 0 ? "Guardar las brasas y remar" : "Remar";
  }
  function ponActo(num, nombre, lema) { $("relActo").textContent = num; $("relNombre").textContent = nombre; $("relLema").textContent = lema; $("relActo").hidden = !num; $("relNombre").hidden = !nombre; $("relLema").hidden = !lema; }
  /* Muestra el relato: las líneas (con su clase), las cartas y el bonus.
     Las líneas se escriben enteras y aparecen con CSS, una tras otra. */
  function muestraRelato(lineas, cartas, bonus, retraso, paso) {
    const cont = $("relLineas");
    cont.replaceChildren();
    cont.style.setProperty("--paso", (paso || 1.6) + "s");
    lineas.forEach((l, i) => { const p = document.createElement("p"); p.textContent = l.t; if (l.cls) p.className = l.cls; p.style.setProperty("--i", i + (retraso || 0)); cont.appendChild(p); });
    const fr = $("relFragmentos");
    fr.replaceChildren();
    (cartas || []).forEach((c, i) => {
      const p = document.createElement("p"); p.className = "carta"; p.style.setProperty("--i", i + lineas.length * 0.6 + (retraso || 0));
      const n = document.createElement("span"); n.className = "num"; n.textContent = c.n;
      p.append(n, document.createTextNode(c.t)); fr.appendChild(p);
    });
    $("relBonus").textContent = bonus || "";
    $("relSeguir").classList.remove("ver");
    relatoListo = 1.2 + (retraso || 0);
    muestra("capaRelato");
  }
  function sigueRelato() {
    if (estado !== "relato" || relatoListo > 0 || !relatoSigue) return;
    const f = relatoSigue; relatoSigue = null;
    oculta("capaRelato"); $("capaRelato").classList.remove("suave", "transito");
    f();
  }

  /* La revelación (después del Faro Ciego): el faro se apaga, las polillas
     que lo cubrían se quedan alrededor de tu luz sin atacar, el relato dice
     lo que eran y las estrellas que apagaste se dejan ver como alas. */
  function revelacion() {
    estado = "revelacion";
    const quedan = jefe ? jefe.orbita.filter(o => o.viva).length : 10;
    jefe = null; escamas = []; balas = []; larvas = [];
    // Las sobrevivientes rodean la llama, quietas.
    lumbres = Array.from({ length: Math.max(8, quedan) }, (_, i) => ({ a: (i / Math.max(8, quedan)) * Math.PI * 2, r: azar(26, 42), w: azar(0.2, 0.4), vr: 0, viva: true, f: Math.random() * 6, quieta: true, x: W / 2, y: 120 }));
    musica.enmudece(3);
    programa(() => musica.estado({ modo: "revelacion" }), 2.5);
    ponActo("", "", "");
    $("capaRelato").classList.add("suave");
    muestraRelato(R.REVELACION.map(t => ({ t })), [], "", 1.2, 2.2);
    // Cada línea trae una campana del tema del fanal.
    R.REVELACION.forEach((_, i) => programa(() => musica.sfx.nota(MU.MOTIVOS.fanal[i % 7][0], 4, 0.08), 1.2 + i * 2.2));
    programa(() => { cielo.fantasmas = 1; $("hudLuces").classList.add("revela"); }, 1.2 + 5 * 2.2);
    relatoAuto = 0;
    relatoListo = 1.2 + R.REVELACION.length * 2.2 + 2;
    relatoSigue = () => {
      // Las que rodeaban la llama suben al cielo y se vuelven estrellas.
      for (const l of lumbres) { cielo.estrellas.push({ x: l.x, y: l.y, z: 1, c: 0, tw: Math.random() * 6, viva: true, muere: 0, nace: 1.5, sube: true }); P.luces++; }
      lumbres = []; cielo.fantasmas = 0; $("hudLuces").classList.remove("revela");
      estado = "juego"; P.terminando = 0;
      terminaJornada();
    };
    estado = "relato";
  }

  /* El cruce con el Alba: las dos luces alumbran lo mismo y el cielo se ve
     lleno de alas. Después vuelve la noche, y la orden: sigue. */
  function cruce() {
    estado = "final";
    escamas = []; balas = []; sombras = [];
    relampago("#fff6e0", 0.9); sacude(0.3);
    musica.sfx.cruce();
    musica.estado({ modo: "final", jefe: null });
    cielo.lleno = 0.001;                                               // empieza la visión
    const piedad = P.piedadJ;
    const lineas = R.FINAL.map(t => ({ t }));
    if (piedad) lineas.push({ t: R.FINAL_PIEDAD });
    lineas.push({ t: R.FINAL_CIERRE }, { t: R.FINAL_ORDEN, cls: "grande" });
    ponActo("", "", "");
    $("capaRelato").classList.add("suave");
    muestraRelato(lineas, [], "", 2.2, 2.4);
    relatoListo = 2.2 + lineas.length * 2.4 + 1;
    relatoAuto = 0;
    // Bonus por haber llegado, y por no haber lanzado nada contra el Alba.
    anota("f");
    suma(M.PUNTOS_JEFE.alba + (P.albaGolpes === 0 ? 5000 : 0));
    prog.alba = true; if (piedad) prog.piedad = true;
    guardaProgreso();
    // La travesía no termina aquí: después de la orden, la otra orilla.
    relatoSigue = () => {
      $("capaRelato").classList.remove("suave");
      P.finalViendo = false; cielo.lleno = 0;
      // El cielo no estaba vacío: las alas que se vieron vuelven a ser estrellas.
      P.luces = 600; cielo.estrellas = creaEstrellas(260, 14);
      estado = "juego"; jefe = null;
      terminaJornada();
    };
    estado = "relato"; P.finalViendo = true;
  }

  /* El final de la segunda parte, al apagar la Hoguera: los fanales que
     ardían en ella se sueltan y cada uno toma su rumbo. Después, sin fin. */
  function finalHoguera() {
    if (!P || estado !== "juego") return;
    estado = "final";
    const libres = jefe ? jefe.libres : 0;
    escamas = []; balas = []; larvas = [];
    musica.enmudece(2.4);
    programa(() => musica.estado({ modo: "final", jefe: null }), 2);
    relampago("#ffe0b0", 0.6);
    // Los fanales sueltos (y los que todavía ardían) se van cada uno por su lado.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      chispas(W / 2 + Math.cos(a) * 30, 62 + Math.sin(a) * 18, 4, ["#ffd070", "#fff0c0"], 50, 2.2);
    }
    luciernagas = luciernagas.filter(l => !l.libre);
    const lineas = R.FINAL_HOGUERA.map(t => ({ t }));
    if (libres >= 8) lineas.push({ t: R.FINAL_HOGUERA_LIBRES });
    lineas.push({ t: R.FINAL_HOGUERA_CIERRE }, { t: R.FINAL_HOGUERA_ORDEN, cls: "grande" });
    ponActo("", "", "");
    $("capaRelato").classList.add("suave");
    muestraRelato(lineas, [], "", 1.6, 2.2);
    R.FINAL_HOGUERA.forEach((_, i) => programa(() => musica.sfx.nota(MU.MOTIVOS.fanal[i % 7][0], 4, 0.08), 1.6 + i * 2.2));
    relatoListo = 1.6 + lineas.length * 2.2 + 1;
    relatoAuto = 0;
    prog.hoguera = true; guardaProgreso();
    relatoSigue = () => {
      $("capaRelato").classList.remove("suave");
      // Las luces que se soltaron quedan en el cielo.
      P.luces += 80 + libres * 10;
      cielo.estrellas = cielo.estrellas.concat(creaEstrellas(80, 25)).slice(-300);
      estado = "juego"; jefe = null;
      terminaJornada();
    };
    estado = "relato";
  }

  /* El final de la historia: el Sol se apaga. Lo que se ve después es la
     luz de todos los fanales, y la noche que vuelve. La travesía sigue:
     los jefes regresan, cambiados (fase 2, y después 3). */
  function finalSol() {
    if (!P || estado !== "juego") return;
    estado = "final";
    escamas = []; balas = []; larvas = []; columnas = [];
    musica.enmudece(2.4);
    programa(() => musica.estado({ modo: "final", jefe: null }), 2);
    relampago("#fff6d8", 0.9); sacude(0.4);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      chispas(W / 2 + Math.cos(a) * 26, 60 + Math.sin(a) * 26, 3, ["#ffd070", "#fff0c0", "#ff9a3c"], 60, 2.4);
    }
    const lineas = R.FINAL_SOL.map(t => ({ t }));
    lineas.push({ t: R.FINAL_SOL_CIERRE }, { t: R.FINAL_SOL_ORDEN, cls: "grande" });
    ponActo("", "", "");
    $("capaRelato").classList.add("suave");
    muestraRelato(lineas, [], "", 1.6, 2.2);
    R.FINAL_SOL.forEach((_, i) => programa(() => musica.sfx.nota(MU.MOTIVOS.fanal[i % 7][0], 4, 0.08), 1.6 + i * 2.2));
    relatoListo = 1.6 + lineas.length * 2.2 + 1;
    relatoAuto = 0;
    prog.sol = true; guardaProgreso();
    relatoSigue = () => {
      $("capaRelato").classList.remove("suave");
      // Las luces que el Sol tapaba vuelven a verse.
      P.luces += 120;
      cielo.estrellas = cielo.estrellas.concat(creaEstrellas(120, 31)).slice(-320);
      estado = "juego"; jefe = null;
      terminaJornada();
    };
    estado = "relato";
  }

  /* El fanal se apaga. */
  function apagaFanal() {
    estado = "muriendo";
    F.apagado = 0.001;
    musica.sfx.apagado();
    musica.estado({ modo: "apagado", jefe: null });
    chispas(F.x, M.Y_FANAL - 6, 40, ["#3a2a1e", "#6a5a4a", "#9a8a7a"], 30, 2.2, "humo");
    programa(() => { enviaResultados(); muestraFin(); }, 2.6);
  }
  /* El techo de los puntos de una travesía. Era 1 000 000 y las travesías
     largas lo pasaban: la tabla quedaba llena de empates en el millón, y
     un empate solo entra con menos tiempo (una travesía más larga tarda
     más), así que ninguna partida nueva se guardaba. Ahora es el de las
     reglas para las tablas sin techo (1 000 000 000). */
  const TOPE_TRAVESIA = 1000000000;
  /* La fila de jornadas de esta cuenta en la nube: undefined mientras no
     se sabe; null si no tiene (llega con `club-tabla`). */
  let filaJornadas;
  /* ¿Mejora esta travesía la tabla de jornadas? Se compara con la fila de
     la nube cuando se conoce, no con el récord local: el local pudo subir
     con una partida que la nube nunca guardó (rechazada o de una versión
     vieja) y entonces ninguna travesía más corta volvía a mandarse, aunque
     superara lo que la tabla tiene. A igual jornada gana el menor tiempo,
     como en la tabla. Sin la nube (invitado, sin conexión), el récord local. */
  function mejoraJornada(jornadas, tiempo) {
    if (!(jornadas >= 1)) return false;
    if (filaJornadas !== undefined) return !filaJornadas || jornadas > filaJornadas.puntos || (jornadas === filaJornadas.puntos && tiempo < filaJornadas.tiempo);
    return jornadas > prog.mejor.jornada;
  }
  /* Manda los puntajes a la clasificación del Club. */
  function enviaResultados() {
    if (!P || P.enviado) return;
    P.enviado = true;
    // La travesía termina aquí: ya no hay nada que retomar.
    prog.punto = { j: 0, at: Date.now() };
    regCierra(F.apagado ? "m" : "a");
    const prueba = P.prueba ? FP.ajusta(JSON.parse(JSON.stringify(P.prueba))) : null;
    const cuenta = !!prueba && !P.tocada && !P.legado;                // ¿entra en la clasificación?
    if (prueba && cuenta) {
      // El juego se revisa a sí mismo con lo mismo que usará el club: si no
      // cuadra es un error de este archivo, y conviene verlo en la consola.
      const r = FP.rehace(prueba);
      if (r.motivo || r.puntos !== Math.round(P.puntos)) console.warn("FANAL: la prueba no cuadra con la partida", r, Math.round(P.puntos));
    }
    const tiempo = Math.max(1, Math.round(P.tiempo * 1000));
    const cat = "club-fanal-travesia";
    const puntos = Math.round(P.puntos);
    const jornadas = P.completadas;
    const m = prog.mejor;
    if (Club && cuenta) {
      if (puntos >= 1) Club.result({ categoria: cat, puntos: Math.min(TOPE_TRAVESIA, puntos), tiempo }, prueba);
      // La jornada solo se manda cuando mejora tu fila: cada resultado
      // cuenta como una partida del club (y paga monedas), y una partida es una sola.
      if (mejoraJornada(jornadas, tiempo)) Club.result({ categoria: "club-fanal-jornadas", puntos: jornadas, tiempo }, prueba);
    }
    // Los récords locales (una partida de prueba no los toca).
    if (!P.tocada) {
      P.nuevoRecord = puntos > m.travesia;
      P.nuevaJornada = jornadas > m.jornada;
      m.travesia = Math.max(m.travesia, puntos);
      m.jornada = Math.max(m.jornada, jornadas);
    }
    guardaProgreso();
  }

  /* Guarda la travesía a medias: cómo empezó la jornada `n` (después del
     taller) y las llamas que ya se perdieron en ella. Si se corta, «Seguir
     la travesía» vuelve al principio de esa jornada: lo ganado en ella se
     pierde, lo perdido no. La prueba de lo jugado viaja con lo guardado, y
     al retomar se rehace (no se le cree al guardado). */
  function guardaPunto(n) {
    if (!P || P.enviado) return;
    prog.punto = {
      j: n, puntos: P.puntosJ0, llamas: P.llamasJ0, luces: P.lucesJ0, mej: Object.assign({}, P.mej), br: P.brasas,
      perdidas: P.perdidasPend + Math.max(0, P.llamasJ0 - P.llamas), notas: P.notasJ0, u: P.uJ, ver: FP.VERSION, at: Date.now()
    };
    if (P.prueba && !P.legado) prog.punto.pr = prDelPunto(Object.assign({ v: P.prueba.v, m: "t", id: P.prueba.id, J: P.prueba.J.slice() }, P.tocada ? { x: 1 } : {}));
    guardaProgreso();
  }
  /* La prueba que viaja con la travesía guardada: tal cual si cabe en el
     progreso, empacada si no (FP.ajusta, sobre una copia: quitarle pulsos
     no puede tocar la de la partida). Se empaca una vez por jornada: entre
     dos tránsitos la prueba no crece, y guardaPunto corre en cada golpe. */
  let prEmpacada = null;
  function prDelPunto(pr) {
    if (JSON.stringify(pr).length <= Math.min(FP.EMPACA_DESDE, M.PRUEBA_PUNTO_MAX)) return pr;
    const clave = pr.id + "|" + pr.J.length + "|" + (pr.x ? 1 : 0);
    if (!prEmpacada || prEmpacada.clave !== clave) prEmpacada = { clave, pr: FP.ajusta(JSON.parse(JSON.stringify(pr)), M.PRUEBA_PUNTO_MAX) };
    return prEmpacada.pr;
  }
  /* La prueba de una travesía guardada, lista para rehacer (o null). Se
     desempaca: la partida sigue anotando en ella. */
  function pruebaGuardada(p) {
    const pr = p && p.pr;
    if (!pr || pr.x || typeof pr.id !== "string") return null;
    const J = FP.jornadasDe(pr);
    if (!Array.isArray(J)) return null;
    return { v: FP.VERSION, m: "t", id: pr.id, u: cuentaUrl, k: 0, J: J.slice() };
  }
  /* Empezar una travesía nueva con otra guardada la da por terminada: lo
     jugado hasta lo guardado va a la clasificación, como si el fanal se
     hubiera apagado ahí. */
  function cierraGuardada() {
    const p = prog.punto;
    if (!p || !(p.j > 0)) return;
    prog.punto = { j: 0, at: Date.now() };
    const prueba = pruebaGuardada(p);
    const r = prueba && prueba.J.length && !tocada ? FP.rehace(prueba) : null;
    if (r && !r.motivo && r.puntos >= 1) {
      const tiempo = Math.max(1, r.tiempo), m = prog.mejor;
      FP.ajusta(prueba);
      if (Club) {
        Club.result({ categoria: "club-fanal-travesia", puntos: Math.min(TOPE_TRAVESIA, r.puntos), tiempo }, prueba);
        if (mejoraJornada(r.completadas, tiempo)) Club.result({ categoria: "club-fanal-jornadas", puntos: r.completadas, tiempo }, prueba);
      }
      m.travesia = Math.max(m.travesia, r.puntos);
      m.jornada = Math.max(m.jornada, r.completadas);
    }
    guardaProgreso();
  }

  /* ================================================================
     Empezar y retomar
     ================================================================
     Hay un solo modo: la travesía, que siempre empieza en la jornada 1 y
     después del Sol no termina. Lo único que se retoma es una travesía
     que quedó a medias (se cerró la página, se cortó la conexión). */
  function empieza(guardada) {
    musica.iniciar(); aplicaSonido();
    P = nuevaPartida(); F = nuevoFanal(); agenda = [];
    particulas = []; flotantes = []; destellos = [];
    html.classList.remove("ultima-llama");
    P.prueba = FP.nueva(nuevoId(), cuentaUrl);
    P.tocada = tocada;
    const p = guardada && guardada.j > 0 ? guardada : null;
    if (p) retoma(p);
    cielo.estrellas = creaEstrellas(Math.min(P.luces, 430), 7);
    luciernagas = [];
    creaMotas();
    if (Club) Club.category("club-fanal-jornadas");
    oculta("capaPortada"); oculta("capaFin");
    if (!p) {                                                          // la introducción, solo al empezar de cero
      cielo.desde = cielo.hacia = 1; cielo.mezcla = 1; document.documentElement.dataset.acto = 1;
      musica.ponEtapa(1, true); musica.estado({ modo: "transito", jefe: null });
      estado = "relato";
      ponActo("", "", "");
      muestraRelato(R.INTRO.map(t => ({ t })), [], "", 0.3, 1.5);
      relatoAuto = 0;
      relatoListo = 0.3 + R.INTRO.length * 1.5;
      relatoSigue = () => { P.jornada = 0; P.j = null; transitoPrimero(); };
    } else {
      cielo.desde = cielo.hacia = 0;                                   // fuerza el cartel del acto
      P.jornada = p.j - 1; P.j = null;
      transito(p.j, null);
    }
    pintaHud(true); pintaLlamas();
  }
  /* Retoma una travesía guardada. Lo jugado se rehace de su prueba (sin
     creerle al guardado) y lo comprado en el taller para la jornada a
     medias se vuelve a comprar. Si la prueba no cuadra (tocada a mano, o de
     __fanal), se juega igual con lo guardado, pero ya no cuenta. */
  function retoma(p) {
    const prueba = pruebaGuardada(p), ult = prueba && prueba.J[prueba.J.length - 1];
    let r = null;
    if (prueba && (ult ? ult.n === p.j - 1 && ult.f === "c" : p.j === 1)) {
      r = FP.rehace(prueba);
      if (r.motivo) r = null;
    }
    if (r) {
      P.prueba = prueba;
      P.puntos = r.puntos; P.mej = r.mej; P.notas = r.notas; P.tiempo = r.tiempo / 1000;
      const est = { mej: P.mej, brasas: r.brasas, llamas: r.llamas };
      let u = "";
      for (const c of typeof p.u === "string" ? p.u : "") { if (M.compra(est, c)) break; u += c; }
      P.brasas = est.brasas; P.llamas = est.llamas; P.uSig = u; P.gastadas = u.length;
    } else {
      P.legado = true;
      if (p.pr && p.pr.x) P.tocada = true;
      P.puntos = Math.max(0, +p.puntos || 0); P.llamas = Math.max(1, p.llamas | 0 || M.LLAMAS_INICIO);
      P.mej = M.limpiaMejoras(p.mej); P.brasas = Math.max(0, p.br | 0); P.notas = Math.max(0, p.notas | 0);
    }
    P.luces = Number.isFinite(p.luces) ? p.luces : 430;
    P.perdidasPend = Math.max(0, p.perdidas | 0);
    P.completadas = p.j - 1;
  }
  /* El primer tránsito (después de la introducción) siempre muestra el acto I. */
  function transitoPrimero() { cielo.hacia = 0; transito(1, null); }

  /* ================================================================
     Capas y paneles
     ================================================================ */
  const html = document.documentElement;
  function muestra(id) { $(id).hidden = false; }
  function oculta(id) { $(id).hidden = true; }
  function abrePanel(id) {
    panelVuelve = panel; panel = id;
    for (const p of ["capaBitacora", "capaAyuda", "capaOpciones"]) if (p !== id) oculta(p);
    if (id === "capaBitacora") pintaBitacora();
    if (id === "capaOpciones") pintaOpciones();
    muestra(id);
    const b = $(id).querySelector("button"); if (b) b.focus({ preventScroll: true });
  }
  function cierraPanel() {
    if (!panel) return;
    oculta(panel); panel = null;
    const vuelve = estado === "pausa" ? "capaPausa" : estado === "portada" ? "capaPortada" : estado === "fin" ? "capaFin" : null;
    if (vuelve) { muestra(vuelve); const b = $(vuelve).querySelector("button:not([hidden])"); if (b) b.focus({ preventScroll: true }); }
  }
  function pausa() {
    if (estado !== "juego" && estado !== "relato") return;
    previoPausa = estado; estado = "pausa";
    musica.pausa(true);
    const c = musica.compasActual();
    $("pausaDetalle").textContent = `Jornada ${P.jornada} · escala ${c.escala} · compás ${c.metrica}`;
    muestra("capaPausa"); $("capaPausa").querySelector("button").focus({ preventScroll: true });
  }
  function sigue() {
    if (estado !== "pausa") return;
    estado = previoPausa; musica.pausa(false);
    oculta("capaPausa"); if (panel) { oculta(panel); panel = null; }
    lienzo.focus({ preventScroll: true });
  }
  function aPortada() {
    musica.pausa(false);
    estado = "portada"; P = null; F = nuevoFanal(); agenda = []; limpiaEntidades();
    for (const id of ["capaFin", "capaPausa", "capaRelato", "capaBitacora", "capaAyuda", "capaOpciones", "capaJefe", "capaTaller"]) oculta(id);
    luciernagas = []; hilos = []; anclas = []; columnas = [];
    $("hudSup").hidden = true;
    html.classList.remove("ultima-llama");
    cielo.desde = cielo.hacia = 1; cielo.mezcla = 1; html.dataset.acto = 1;
    cielo.estrellas = creaEstrellas(260, 3); creaMotas(); cielo.lleno = 0; cielo.velObj = 4;
    musica.ponEtapa("titulo", true); musica.estado({ modo: "titulo", jefe: null });
    if (Club) Club.category("club-fanal-jornadas");
    pintaPortada(); muestra("capaPortada");
    pintaHud(true); pintaLlamas();
  }
  function pintaPortada() {
    const p = prog.punto, c = $("btnContinuar"), n = $("btnNueva"), hay = !!(p && p.j > 0);
    c.hidden = !hay;
    if (hay) c.textContent = "Seguir la travesía · jornada " + p.j;
    c.classList.toggle("principal", hay); n.classList.toggle("principal", !hay);
    delete n.dataset.armado;
    n.textContent = hay ? "Nueva travesía" : "Empezar la travesía";
    $("btnBitacora").textContent = `Bitácora · ${prog.frag.length}/${R.FRAGMENTOS.length}`;
    const m = prog.mejor;
    $("records").textContent = m.travesia || m.jornada ? `Récord ${m.travesia.toLocaleString("es-CL")} · jornada ${m.jornada}` : "";
  }
  function pintaBitacora() {
    const l = $("listaCartas"); l.replaceChildren();
    R.FRAGMENTOS.forEach((f, i) => {
      const li = document.createElement("li");
      const n = document.createElement("span"); n.className = "num"; n.textContent = R.romano(i + 1);
      if (prog.frag.includes(i)) li.append(n, document.createTextNode(f.texto));
      else { li.className = "perdida"; li.append(n, document.createTextNode("— carta perdida —")); }
      l.appendChild(li);
    });
    const ve = prog.ecos.length > 0;
    $("ecosTitulo").hidden = !ve; $("listaEcos").hidden = !ve;
    const le = $("listaEcos"); le.replaceChildren();
    if (ve) prog.ecos.forEach(i => { const li = document.createElement("li"); li.textContent = R.ECOS[i]; le.appendChild(li); });
  }
  function muestraFin() {
    estado = "fin";
    oculta("capaRelato"); oculta("capaTaller");
    const s = P.stats, prec = s.disparos ? Math.round((s.aciertos / s.disparos) * 100) : 0, af = s.disparos ? Math.round((s.afinados / s.disparos) * 100) : 0;
    $("finTitulo").textContent = F.apagado ? "El fanal se apagó" : "Dejaste el remo";
    $("finLinea").textContent = R.APAGADO[Math.floor(Math.random() * R.APAGADO.length)];
    if (P.tocada || P.legado) $("finLinea").textContent += P.tocada
      ? " (Partida de prueba: se usó __fanal, no entra en la clasificación.)"
      : " (Se retomó una travesía guardada cuya prueba no cuadra: no entra en la clasificación.)";
    const min = Math.floor(P.tiempo / 60), seg = Math.floor(P.tiempo % 60);
    const filas = [
      ["Puntos", Math.round(P.puntos).toLocaleString("es-CL"), P.nuevoRecord],
      ["Jornada", String(P.jornada) + (P.completadas >= M.JORNADAS_HISTORIA ? " · después del Sol" : P.completadas >= M.JORNADA_HOGUERA ? " · lo alto" : P.completadas >= M.JORNADA_ALBA ? " · la otra orilla" : ""), P.nuevaJornada],
      ["Polillas apagadas", s.apagadas], ["Precisión", prec + " %"], ["Tiros afinados", af + " %"],
      ["Mejor resonancia", "×" + s.mejorRes], ["Cartas recuperadas", s.cartas], ["Llamas perdidas", s.danios],
      ["La llama", R.EVOLUCIONES.arma[M.evolucion(P.mej, "arma")].nombre], ["El fanal", R.EVOLUCIONES.nave[M.evolucion(P.mej, "nave")].nombre],
      ["Brasas gastadas", P.gastadas + (P.brasas ? " (" + P.brasas + " sin gastar)" : "")],
      ["Tiempo de travesía", `${min}:${String(seg).padStart(2, "0")}`]
    ];
    if (P.completadas >= 7) filas.push(["Lumbres acogidas", P.acogidas + " de 24"]);
    const dl = $("finStats"); dl.replaceChildren();
    for (const [k, v, nuevo] of filas) { const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v; if (nuevo) dd.className = "nuevo"; dl.append(dt, dd); }
    muestra("capaFin");
    $("capaFin").querySelector("button:not([hidden])").focus({ preventScroll: true });
    $("hudSup").hidden = true;
  }

  /* Los botones de todas las capas comparten un manejador por acción. */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-accion]");
    if (!b || b.disabled) return;
    musica.iniciar(); aplicaSonido();
    musica.sfx.ui(2);
    const a = b.dataset.accion;
    if (a === "nueva") {
      // Con una travesía guardada, «Nueva travesía» la cierra: se pide dos veces.
      if (b.id === "btnNueva" && prog.punto && prog.punto.j > 0 && !b.dataset.armado) {
        b.dataset.armado = "1"; b.textContent = "¿Cerrar la guardada? Pulsa otra vez";
        return;
      }
      cierraGuardada(); empieza(null);
    }
    else if (a === "continuar") { if (prog.punto && prog.punto.j > 0) empieza(prog.punto); }
    else if (a === "taller-seguir") cierraTaller();
    else if (a === "bitacora") abrePanel("capaBitacora");
    else if (a === "ayuda") abrePanel("capaAyuda");
    else if (a === "opciones") abrePanel("capaOpciones");
    else if (a === "volver") cierraPanel();
    else if (a === "seguir") sigue();
    else if (a === "salir") aPortada();                               // la travesía queda guardada
    else if (a === "terminar") {
      if (P) { oculta("capaPausa"); musica.pausa(false); musica.estado({ modo: "apagado", jefe: null }); enviaResultados(); muestraFin(); }
    }
    else if (a === "portada") aPortada();
  });
  $("capaRelato").addEventListener("pointerdown", () => sigueRelato());
  $("capaTaller").addEventListener("click", e => { const b = e.target.closest("[data-codigo]"); if (b && !b.disabled) compraTaller(b.dataset.codigo); });
  $("btnPausa").addEventListener("click", () => (estado === "pausa" ? sigue() : pausa()));

  /* ---------- Opciones y sonido ---------- */
  function pintaOpciones() {
    $("optLineas").checked = opciones.lineas; $("optAberracion").checked = opciones.aberracion; $("optDestellos").checked = opciones.destellos;
    $("optSacudida").value = String(opciones.sacudida); $("optMusica").value = Math.round(opciones.musica * 100); $("optEfectos").value = Math.round(opciones.efectos * 100);
  }
  function aplicaOpciones() {
    html.classList.toggle("sin-lineas", !opciones.lineas);
    musica.volumenes(opciones.musica, opciones.efectos);
  }
  $("optLineas").onchange = e => { opciones.lineas = e.target.checked; aplicaOpciones(); guardaOpciones(); };
  $("optAberracion").onchange = e => { opciones.aberracion = e.target.checked; guardaOpciones(); };
  $("optDestellos").onchange = e => { opciones.destellos = e.target.checked; guardaOpciones(); };
  $("optSacudida").onchange = e => { opciones.sacudida = +e.target.value; guardaOpciones(); };
  $("optMusica").oninput = e => { opciones.musica = +e.target.value / 100; aplicaOpciones(); guardaOpciones(); };
  $("optEfectos").oninput = e => { opciones.efectos = +e.target.value / 100; aplicaOpciones(); guardaOpciones(); musica.sfx.ui(4); };
  function aplicaSonido() {
    musica.silenciar(!opciones.sonido);
    const b = $("sound-button"); b.setAttribute("aria-pressed", String(opciones.sonido)); b.textContent = opciones.sonido ? "♪" : "♪";
  }
  function alternaSonido() { opciones.sonido = !opciones.sonido; musica.iniciar(); aplicaSonido(); guardaOpciones(); }
  $("sound-button").addEventListener("click", alternaSonido);

  /* ================================================================
     Entrada: teclado, dedo y botones táctiles
     ================================================================ */
  const TECLA = { ArrowLeft: "izq", KeyA: "izq", ArrowRight: "der", KeyD: "der", Space: "fuego", KeyZ: "fuego", ArrowUp: "fuego", KeyW: "fuego", KeyJ: "fuego" };
  document.addEventListener("keydown", e => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const t = TECLA[e.code];
    if (t) cuentaEntrada(e);
    if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      if (panel) cierraPanel(); else if (estado === "pausa") sigue(); else pausa();
      return;
    }
    if (e.code === "KeyM") { alternaSonido(); return; }
    // En el taller: 1–8 compran las mejoras (en el orden en que se ven), 9 enciende una llama.
    if (estado === "taller") {
      const d = /^(Digit|Numpad)([1-9])$/.exec(e.code);
      if (d) { e.preventDefault(); const i = +d[2] - 1; compraTaller(i < 8 ? M.MEJORAS[M.LISTA_MEJORAS[i]].codigo : M.CODIGO_LLAMA); }
      return;                                                         // el resto del teclado es de los botones
    }
    if (estado === "relato" && (t === "fuego" || e.code === "Enter")) { e.preventDefault(); if (!e.repeat) sigueRelato(); return; }
    if (t) {
      if (estado === "portada" || estado === "fin" || panel) return;  // en los menús, el teclado es de los botones
      e.preventDefault();
      if (t === "fuego" && !teclas.fuego && !e.repeat) { musica.iniciar(); disparar(); autoT = 0.3; }
      teclas[t] = true;
    }
  });
  document.addEventListener("keyup", e => { const t = TECLA[e.code]; if (t) teclas[t] = false; });
  /* Mando de consola (juegos/audio/mando.js): la cruceta o el stick reman,
     A dispara (mantenido, como Espacio), Start pausa. En la portada, el fin
     y los paneles manda el cursor. */
  if (window.Mando) window.Mando.configura({
    botones: { a: "Space", rt: "Space", start: "KeyP", y: "KeyM" },
    menu: () => estado === "portada" || estado === "fin" || estado === "final" || estado === "pausa" || estado === "taller" || !!panel,
    pistas: [["dpad stickL", "remar"], ["a rt", "disparar al pulso"], ["start", "pausa"], ["y", "sonido"]],
    zonas: [{ sel: ".pie" }]
  });
  // El dedo (o el ratón) sobre el lienzo: rema hasta donde está y dispara al tocar.
  const aLogico = ev => { const r = lienzo.getBoundingClientRect(); return ((ev.clientX - r.left) / r.width) * W; };
  lienzo.addEventListener("pointerdown", ev => {
    cuentaEntrada(ev);
    if (estado === "relato") { sigueRelato(); return; }
    if (estado !== "juego") return;
    ev.preventDefault(); lienzo.setPointerCapture(ev.pointerId);
    musica.iniciar();
    toque = aLogico(ev); disparar(); autoT = 0.3;
  });
  lienzo.addEventListener("pointermove", ev => { if (toque != null) toque = aLogico(ev); });
  const suelta = () => { toque = null; };
  lienzo.addEventListener("pointerup", suelta); lienzo.addEventListener("pointercancel", suelta);
  for (const b of document.querySelectorAll("#tactil [data-tecla]")) {
    const t = b.dataset.tecla;
    b.addEventListener("pointerdown", ev => {
      cuentaEntrada(ev);
      ev.preventDefault(); b.setPointerCapture(ev.pointerId); b.classList.add("activo");
      musica.iniciar();
      if (estado === "relato") { sigueRelato(); return; }
      if (t === "fuego" && !teclas.fuego) { disparar(); autoT = 0.3; }
      teclas[t] = true;
    });
    const fin = () => { teclas[t] = false; b.classList.remove("activo"); };
    b.addEventListener("pointerup", fin); b.addEventListener("pointercancel", fin); b.addEventListener("lostpointercapture", fin);
    // iOS: sin esto, una pulsación larga selecciona el texto o abre el menú y se
    // queda con el dedo, y el pointerup no llega nunca. touchend llega siempre.
    b.addEventListener("touchstart", ev => ev.preventDefault(), { passive: false });
    b.addEventListener("touchend", fin); b.addEventListener("touchcancel", fin);
    b.addEventListener("contextmenu", ev => ev.preventDefault());
    b.addEventListener("selectstart", ev => ev.preventDefault());
  }
  // Red de seguridad: si ningún dedo queda en pantalla, ningún botón puede seguir apretado.
  const sueltaBotones = () => {
    for (const b of document.querySelectorAll("#tactil [data-tecla].activo")) { b.classList.remove("activo"); teclas[b.dataset.tecla] = false; }
  };
  document.addEventListener("touchend", ev => { if (!ev.touches.length) sueltaBotones(); });
  document.addEventListener("touchcancel", ev => { if (!ev.touches.length) sueltaBotones(); });
  // Si se va la pestaña o el foco, se pausa: nadie debería perder una llama sin estar mirando.
  document.addEventListener("visibilitychange", () => { if (document.hidden) { if (estado === "juego") pausa(); for (const k in teclas) teclas[k] = false; toque = null; sueltaBotones(); } });
  window.addEventListener("blur", () => { for (const k in teclas) teclas[k] = false; toque = null; sueltaBotones(); if (estado === "juego") pausa(); });

  /* ================================================================
     HUD
     ================================================================ */
  const cacheHud = {};
  function ponTexto(id, v) { if (cacheHud[id] !== v) { cacheHud[id] = v; $(id).textContent = v; } }
  function pintaHud(forzar) {
    if (forzar) for (const k in cacheHud) delete cacheHud[k];
    ponTexto("hudPuntos", P ? Math.round(P.puntos).toLocaleString("es-CL") : "0");
    const rec = prog.mejor.travesia;
    ponTexto("hudRecord", Math.max(rec, P ? Math.round(P.puntos) : 0).toLocaleString("es-CL"));
    ponTexto("hudRes", "×" + multiplicador());
    if (!P) return;
    const j = P.j || M.jornada(Math.max(1, P.jornada));
    const nombre = j.acto === 5 ? R.actoInfo(j.actoBase).nombre + " · FASE " + R.romano(j.fase || 2) + gradoTexto(j) : R.actoInfo(j.acto).nombre;
    ponTexto("hudJornada", `JORNADA ${Math.max(1, P.jornada)} · ${nombre}`);
    ponTexto("hudLuces", "✦ " + Math.max(0, P.luces));
    ponTexto("hudBrasas", P.brasas > 0 ? "🔥 " + P.brasas : "");
    let alba;
    const n = Math.max(1, P.jornada);
    if (n > M.JORNADAS_HISTORIA) alba = "VUELTA " + ((j.vuelta || 0) + 1);
    else if (n === M.JORNADAS_HISTORIA) alba = "EL SOL";
    else if (n > M.JORNADA_ALBA) { const q = M.JORNADAS_HISTORIA - n + 1; alba = "AL SOL · " + q + (q === 1 ? " JORNADA" : " JORNADAS"); }
    else if (jefe && jefe.tipo === "alba") alba = cielo.lleno > 0 ? "EL ALBA · CRUZADA" : "AL ALBA · " + Math.ceil(jefe.dist) + (Math.ceil(jefe.dist) === 1 ? " BRAZA" : " BRAZAS");
    else { const q = M.JORNADA_ALBA - Math.max(1, P.jornada) + 1; alba = "AL ALBA · " + q + (q === 1 ? " JORNADA" : " JORNADAS"); }
    ponTexto("hudAlba", alba);
  }
  function pintaLlamas() {
    const c = $("hudLlamas"), n = P ? P.llamas : M.LLAMAS_INICIO, total = Math.max(3, n);
    if (cacheHud.llamas === n) return;
    cacheHud.llamas = n;
    c.replaceChildren();
    for (let i = 0; i < total; i++) { const e = document.createElement("i"); if (i >= n) e.className = "apagada"; c.appendChild(e); }
    c.setAttribute("aria-label", n + (n === 1 ? " llama" : " llamas"));
    html.classList.toggle("ultima-llama", !!P && n === 1);
  }

  /* ================================================================
     Actualizar
     ================================================================ */
  function actualiza(dt) {
    corre(dt);
    // Cámara lenta tras un golpe grande (la muerte de un jefe se siente).
    const dtj = dt * fx.lenta;
    if (P) {
      if (estado === "juego") P.tiempo += dt;
      P.cadenaT -= dt; if (P.cadenaT <= 0) P.cadena = 0;
    }
    actualizaCielo(dt);
    if (F) actualizaFanal(dtj);
    if (estado === "juego" && P && P.j) {
      // La Mensajera cruza de vez en cuando (en las oleadas y entre las lumbres).
      if (P.mensajerasRest > 0 && !msj && !(form && form.entrando && P.j.tipo === "oleada")) { P.tMensajera -= dtj; if (P.tMensajera <= 0) { lanzaMensajera(); P.mensajerasRest--; P.tMensajera = P.j.mensajeras > 2 ? azar(9, 14) : azar(15, 24); } }
      if (P.j.tipo === "oleada") {
        actualizaFormacion(dtj);
        if (form.restan === 0 && !form.entrando && !P.terminando) { P.terminando = 1; fx.lenta = 0.35; fx.lentaT = 0.6; programa(terminaJornada, 1.1); }
      }
      if (P.j.tipo === "lumbre") actualizaLumbres(dtj);
    }
    if (estado === "revelacion" || (estado === "relato" && lumbres.length && lumbres[0].quieta)) actualizaQuietas(dt);
    actualizaMensajera(dtj);
    actualizaJefe(dtj);
    actualizaLarvas(dtj);
    actualizaSombras(dtj);
    actualizaCenizas(dtj);
    actualizaHilos(dtj);
    actualizaAnclas(dtj);
    if (estado === "juego") derivaNaufragios(dtj);
    actualizaBalas(dtj);
    actualizaEscamas(dtj);
    // Poderes que caen.
    for (let i = poderes.length - 1; i >= 0; i--) {
      const p = poderes[i]; p.t += dtj; p.y += 34 * dtj; p.x += Math.sin(p.t * 2.5) * 6 * dtj;
      if (F && !F.apagado && estado === "juego" && Math.abs(p.x - F.x) < 9 && Math.abs(p.y - (M.Y_FANAL - 3)) < 8) { tomaPoder(p); poderes.splice(i, 1); }
      else if (p.y > H + 6) poderes.splice(i, 1);
    }
    // Partículas y textos.
    for (let i = particulas.length - 1; i >= 0; i--) {
      const q = particulas[i]; q.vida -= dt;
      if (q.vida <= 0) { particulas.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g || 0) * dt;
      if (q.tipo === "humo") { q.vy -= 14 * dt; q.vx *= 0.98; } else if (q.tipo !== "viento") { q.vx *= 0.96; q.vy *= q.tipo === "polvo" ? 0.97 : 0.95; }
    }
    for (let i = flotantes.length - 1; i >= 0; i--) { const f = flotantes[i]; f.vida -= dt; f.y -= 16 * dt; if (f.vida <= 0) flotantes.splice(i, 1); }
    for (let i = destellos.length - 1; i >= 0; i--) { const d = destellos[i]; d.t += dt; if (d.t > d.dur) destellos.splice(i, 1); }
    // Efectos de pantalla que se apagan solos.
    fx.trauma = Math.max(0, fx.trauma - dt * 1.4);
    fx.aberr = Math.max(0, fx.aberr - dt * 1.6);
    fx.flash = Math.max(0, fx.flash - dt * 2.2);
    fx.metro = Math.max(0, fx.metro - dt * 3);
    fx.eclipse += (fx.eclipseObj - fx.eclipse) * (1 - Math.exp(-dt * 3));
    if (fx.lentaT > 0) { fx.lentaT -= dt; if (fx.lentaT <= 0) fx.lenta = 1; }
    pulsoLuz = Math.max(0, pulsoLuz - dt * 4);
    if (avisoT > 0) { avisoT -= dt; if (avisoT <= 0) $("aviso").classList.remove("ver"); }
    if (relatoListo > 0) { relatoListo -= dt; if (relatoListo <= 0 && relatoSigue) $("relSeguir").classList.add("ver"); }
    if (estado === "relato" && relatoAuto > 0) { relatoAuto -= dt; if (relatoAuto <= 0 && relatoListo <= 0) sigueRelato(); }
    if (cielo.lleno > 0) cielo.lleno += dt;
    // La música sabe cómo va la jornada.
    if (P && P.j && estado === "juego") {
      let tension = 0, peligro = 0;
      if (P.j.tipo === "oleada" && form) {
        tension = 1 - form.restan / form.total;
        const maxY = Math.max(0, ...polillas.filter(p => p.viva && p.estado === "fila").map(p => p.y + p.h));
        peligro = clamp((maxY - 150) / 120, 0, 1);
      } else if (jefe && jefe.tipo !== "alba") tension = 0.4 + 0.6 * (1 - jefe.vida / jefe.max);
      const cerca = escamas.filter(e => e.y > 220 && Math.abs(e.x - F.x) < 40).length;
      peligro = Math.max(peligro, clamp(cerca / 4, 0, 1), P.llamas === 1 ? 0.4 : 0);
      musica.estado({ tension, peligro, latido: P.j.tipo === "oleada" ? M.latido(form ? form.restan / form.total : 1) : 1 });
      pintaHud();
    }
  }
  /* Las polillas que rodean la llama en la revelación. */
  function actualizaQuietas(dt) {
    for (const l of lumbres) {
      l.a += l.w * dt;
      const tx = F.x + Math.cos(l.a) * l.r, ty = M.Y_FANAL - 40 + Math.sin(l.a) * l.r * 0.6;
      l.x += (tx - l.x) * (1 - Math.exp(-dt * 1.4)); l.y += (ty - l.y) * (1 - Math.exp(-dt * 1.4));
    }
  }
  function actualizaCielo(dt) {
    cielo.vel += (cielo.velObj - cielo.vel) * (1 - Math.exp(-dt * 1.5));
    cielo.desp += cielo.vel * dt;
    if (cielo.mezcla < 1) cielo.mezcla = Math.min(1, cielo.mezcla + dt / 4.5);
    for (const e of cielo.estrellas) {
      e.y += cielo.vel * e.z * 0.35 * dt;
      if (e.sube) { e.y -= 30 * dt; if (e.y < 30 + e.tw * 20) e.sube = false; }   // las que suben al cielo
      if (e.y > H) e.y -= H;
      if (e.muere > 0) { e.muere -= dt; if (e.muere <= 0) { e.viva = false; e.muere = 0; } }
      if (e.nace > 0) e.nace = Math.max(0, e.nace - dt);
    }
    cielo.estrellas = cielo.estrellas.filter(e => e.viva || e.muere > 0);
    for (const m of cielo.motas) {
      const acto = cielo.hacia;
      m.y += (acto === 4 || acto === 6 || acto === 8 || acto === 9 || acto === 11 ? -10 : acto === 3 ? 9 : acto === 10 ? 2 : 6) * m.z * dt + cielo.vel * m.z * 0.5 * dt;
      m.x += Math.sin(tMusica * 0.6 + m.f) * 4 * dt;
      if (m.y > H + 2) { m.y = -2; m.x = Math.random() * W; }
      if (m.y < -2) { m.y = H + 2; m.x = Math.random() * W; }
    }
    // Lo oscuro: siluetas enormes que pasan muy lejos (la noche está llena).
    if (cielo.hacia === 3 || cielo.hacia === 5) {
      cielo.tSilueta -= dt;
      if (cielo.tSilueta <= 0) { cielo.tSilueta = azar(12, 20); cielo.siluetas.push({ x: azar(30, W - 30), y: -90, vy: azar(5, 8), tipo: Math.random() < 0.5 ? "nodriza" : "esfinge", a: 0 }); }
    }
    for (const s of cielo.siluetas) { s.y += s.vy * dt + cielo.vel * 0.1 * dt; s.a = Math.min(1, s.a + dt * 0.2); }
    cielo.siluetas = cielo.siluetas.filter(s => s.y < H + 100);
  }

  /* Lo que pasa en cada pulso de la música: la formación da un paso (el
     latido), las alas cambian de cuadro y la llama late. */
  function alPulso(p) {
    pulsoLuz = p.nivel === 2 ? 1 : 0.6;
    if (form && !form.entrando) { form.empuje = 1; form.cuadro ^= 1; }
    if (jefe && jefe.tipo === "faro") jefe.cuadro ^= 1;
    fx.metroPulso = p.nivel;
    if (jefe && jefe.compas) compasPulso(p);   // el Compás de la Crisálida (fase 5) baja al ritmo de la música
  }

  /* ================================================================
     Dibujar
     ================================================================ */
  function dibujaFondo(acto, alfa) {
    if (!acto) return;
    const f = fondoDe(acto);
    ex.globalAlpha = alfa;
    ex.drawImage(f.cielo, 0, 0);
    if (f.nubes) {
      const h = f.nubes.height, y = (cielo.desp * 0.25) % h;
      ex.drawImage(f.nubes, 0, y - h); ex.drawImage(f.nubes, 0, y);
    }
    ex.globalAlpha = 1;
  }
  function dibujaEstrellas() {
    const p = S.PALETAS[cielo.hacia] || S.PALETAS[1];
    const niebla = cielo.hacia === 2 ? 0.45 : 0;
    for (const e of cielo.estrellas) {
      let a = (0.45 + 0.55 * Math.sin(tMusica * 1.6 + e.tw)) * e.z;
      if (e.muere > 0) a = e.muere > 0.6 ? 1 : e.muere / 0.6;           // el último destello antes de apagarse
      if (e.nace > 0) a *= 1 - e.nace / 1.5;
      a *= 1 - niebla * (1 - e.z);
      if (a <= 0.04) continue;
      ex.globalAlpha = Math.min(1, a);
      ex.fillStyle = e.muere > 0.6 ? "#ffffff" : p.estrella[e.c];
      const x = Math.floor(e.x), y = Math.floor(e.y);
      ex.fillRect(x, y, 1, 1);
      if (e.z > 0.93 || e.muere > 0.6) { ex.globalAlpha *= 0.5; ex.fillRect(x - 1, y, 3, 1); ex.fillRect(x, y - 1, 1, 3); }
    }
    ex.globalAlpha = 1;
    // La revelación: donde se apagaron estrellas, por un momento, alas.
    if (cielo.fantasmas > 0) {
      const img = banco.mini(1, Math.floor(tMusica * 3) & 1);
      const r = M.mulberry32(17);
      ex.globalAlpha = 0.35 + 0.25 * Math.sin(tMusica * 2);
      for (let i = 0; i < Math.min(160, P ? P.stats.apagadas : 60); i++) ex.drawImage(img, Math.floor(r() * (W - 7)), Math.floor(r() * 230) + 16);
      ex.globalAlpha = 1;
    }
  }
  function dibujaMotas() {
    const acto = cielo.hacia, p = S.PALETAS[acto] || S.PALETAS[1];
    ex.fillStyle = p.particula;
    for (const m of cielo.motas) {
      ex.globalAlpha = acto === 4 || acto === 8 || acto === 11 ? 0.7 : acto === 3 || acto === 10 ? 0.5 : 0.35;
      ex.fillRect(Math.floor(m.x), Math.floor(m.y), m.z > 1.2 ? 2 : 1, 1);
    }
    ex.globalAlpha = 1;
  }
  function dibujaSiluetas() {
    for (const s of cielo.siluetas) {
      const sil = siluetaOscura(s.tipo);
      ex.globalAlpha = 0.09 * s.a;
      ex.drawImage(sil, Math.floor(s.x - sil.width * 1.5), Math.floor(s.y), sil.width * 3, sil.height * 3);
      ex.globalAlpha = 1;
    }
  }
  /* La silueta de un jefe, del color de lo oscuro (una por tipo y acto). */
  const siluetas = {};
  function siluetaOscura(tipo) {
    const k = tipo + cielo.hacia;
    return siluetas[k] || (siluetas[k] = S.silueta(tipo === "nodriza" ? banco.nodriza(0) : banco.esfinge(0), cielo.hacia === 5 ? "#3a4a6a" : "#5a4a80"));
  }
  /* Los rayos del alba, desde arriba, girando muy despacio. */
  function dibujaRayos(alfa) {
    lx.save(); lx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 6; i++) {
      const a = -0.9 + i * 0.36 + Math.sin(tMusica * 0.1 + i) * 0.06;
      lx.globalAlpha = (0.018 + 0.012 * Math.sin(tMusica * 0.5 + i * 2)) * alfa;
      lx.fillStyle = "#ffe6c0";
      lx.beginPath(); lx.moveTo(W / 2 - 10, -10); lx.lineTo(W / 2 + Math.sin(a) * 420 - 14, Math.cos(a) * 420); lx.lineTo(W / 2 + Math.sin(a) * 420 + 14, Math.cos(a) * 420); lx.closePath(); lx.fill();
    }
    lx.restore();
  }
  /* Un brillo aditivo redondo en la capa de luz. */
  function brillo(x, y, r, col, a) {
    if (!(r > 0) || !(a > 0) || !Number.isFinite(x + y + r)) return;
    const g = lx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
    lx.globalAlpha = Math.min(1, a); lx.fillStyle = g; lx.fillRect(x - r, y - r, r * 2, r * 2); lx.globalAlpha = 1;
  }

  function dibujaPolillas() {
    const j = P && P.j, acto = actoVisual(j), forma = formaDe(j);
    for (const p of polillas) {
      if (!p.viva) continue;
      const cuadro = p.estado === "picada" ? Math.floor(p.t * 10) & 1 : form.cuadro ^ (p.col & 1) ^ (p.fila & 1);
      ex.drawImage(banco.polilla(acto, p.tipo, cuadro, forma, p.flash > 0), Math.floor(p.x), Math.floor(p.y));
      if (p.vida > 1 && p.estado !== "entrando") { ex.fillStyle = S.paletaPolilla(acto, p.tipo, forma).f; ex.fillRect(Math.floor(p.x + p.w / 2), Math.floor(p.y - 2), 1, 1); } // aguanta otro golpe
    }
  }
  function dibujaJefe() {
    if (!jefe) return;
    // `fase` elige el modelo (sprites.js lo dibuja ya a su tamaño); `e` es
    // cuánto más grande es, para poner en su sitio lo que se pinta vivo.
    const t = jefe.tipo, blanco = jefe.flash > 0, fase = jefe.fase || 1, e = escalaJefe();
    const muere = seg => (jefe.muerto ? Math.max(0, 1 - jefe.muerto / seg) : 1);
    if (t === "nodriza") {
      const img = banco.nodriza(jefe.cuadro, blanco, fase);
      ex.globalAlpha = muere(1.2);
      pintaCuerpo(img, jefe.x, jefe.y);
      ex.globalAlpha = 1;
      const a = jefe.ataque;
      if (a && a.t < 0.6 && a.nombre === "abanico") { brillo(jefe.x - 16 * e, jefe.y + 2, 14, "#ffd27a", a.t * 1.4); brillo(jefe.x + 16 * e, jefe.y + 2, 14, "#ffd27a", a.t * 1.4); }
      if (a && (a.nombre === "puesta" || a.nombre === "esp2") && a.t < 0.6) brillo(jefe.x, jefe.y - 14 * e, 12, "#fff0c8", a.t * 2);
      if (a && a.nombre === "esp3" && a.t < 0.6) for (const s of [-1, 1]) brillo(jefe.x + s * 18 * e, jefe.y, 18, "#e8d8c0", a.t * 1.4);
      if (a && a.nombre === "aleteo" && a.t < 0.8) { lx.fillStyle = "#e8d8c0"; for (let i = 0; i < 6; i++) { lx.globalAlpha = 0.4 * (a.t / 0.8); const y = 160 + i * 24 + Math.sin(tMusica * 6 + i) * 4, x0 = a.dir > 0 ? 4 : W - 34; lx.fillRect(x0 + ((tMusica * 60 * a.dir) % 20), y, 22, 1); } lx.globalAlpha = 1; }
    } else if (t === "faro") {
      const img = banco.faro(blanco, fase);
      ex.globalAlpha = jefe.muerto ? Math.max(0.15, 1 - jefe.muerto / 1.6) : 1;
      pintaCuerpo(img, jefe.x, jefe.y - 1);
      ex.globalAlpha = 1;
      for (const o of jefe.orbita || []) if (o.viva) {
        const ox = jefe.x + Math.cos(o.a) * o.r, oy = jefe.y + Math.sin(o.a) * o.r * 0.7;
        ex.drawImage(banco.mini(2, (Math.floor(tMusica * 8 + o.f)) & 1), Math.floor(ox - 3), Math.floor(oy - 2));
      }
      dibujaHaz();
      dibujaBalizas();
    } else if (t === "esfinge") {
      const img = banco.esfinge(jefe.cuadro, blanco, fase);
      ex.globalAlpha = muere(1.4) * jefe.alfa;
      pintaCuerpo(img, jefe.x, jefe.y);
      // El Espejismo: las falsas se pintan igual que ella. Lo único que no copian son las marcas encendidas.
      for (const d of jefe.espejos || []) if (d.viva) pintaCuerpo(banco.esfinge(jefe.cuadro, false, fase), d.x, d.y + Math.sin(tMusica * 0.8 + d.x) * 3);
      ex.globalAlpha = 1;
      // Las marcas de hueso se encienden antes de atacar.
      const m = jefe.marcas || 0;
      if (m > 0 && !jefe.muerto) for (const [mx, my] of S.MARCAS_ESFINGE) brillo(jefe.x + (mx - 39) * e, jefe.y + (my - 22) * e, 7, fase >= 5 ? "#fff2c8" : fase === 4 ? "#c8f0ff" : fase === 3 ? "#fffaf0" : "#e8dcc8", m * 0.9);
      if (jefe.ataque && jefe.ataque.nombre === "picada" && jefe.ataque.etapa === "marca") { lx.fillStyle = "#c7a6ff"; lx.globalAlpha = 0.18; lx.fillRect(Math.floor(jefe.x) - 1, 40, 2, H); lx.globalAlpha = 1; }
      if (jefe.pista != null) { brillo(jefe.pista, 34, 10, "#e8dcc8", 0.9); ex.fillStyle = "#e8dcc8"; ex.fillRect(jefe.pista - 3, 30, 7, 1); ex.fillRect(jefe.pista - 2, 31, 5, 1); ex.fillRect(jefe.pista - 1, 32, 3, 1); }
    } else if (t === "casco") {
      const img = banco.casco(jefe.cuadro, blanco, fase);
      ex.globalAlpha = muere(1.6);
      const cy = jefe.y + (jefe.muerto ? jefe.muerto * 30 : 0);
      pintaCuerpo(img, jefe.x, cy);
      ex.globalAlpha = 1;
      // Su llama, colgando dentro del farol: todavía arde (salvo cuando salió a buscarte: el Fuego fatuo).
      if (!jefe.sinLlama && (!jefe.muerto || jefe.muerto < 1)) { const fx0 = Math.floor(jefe.x), fy0 = Math.floor(cy + 10 * e); ex.fillStyle = fase >= 3 ? "#a8c8ff" : "#ff9a3c"; ex.fillRect(fx0 - 1, fy0 - 1, 3, 3); ex.fillStyle = fase >= 3 ? "#ffffff" : "#fff0b0"; ex.fillRect(fx0, fy0 + (Math.sin(tMusica * 15) > 0 ? 1 : 0), 1, 2); }
      if (jefe.marcaX != null && !jefe.muerto) { lx.fillStyle = "#7aa8a0"; for (let y = 50; y < H; y += 6) { lx.globalAlpha = 0.5; lx.fillRect(Math.floor(jefe.marcaX), y, 1, 2); } lx.globalAlpha = 1; }
      const w = jefe.fatuo;
      if (w) {
        const x = Math.floor(w.x), y = Math.floor(w.y), alto = 4 + (Math.sin(tMusica * 14) > 0 ? 1 : 0);
        ex.fillStyle = "#3c6cc8"; ex.fillRect(x - 2, y - 1, 5, 4);
        ex.fillStyle = "#a8c8ff"; ex.fillRect(x - 1, y - alto + 1, 3, alto + 1);
        ex.fillStyle = "#ffffff"; ex.fillRect(x, y - 1, 1, 2);
        brillo(w.x, w.y, 14, "#a8c8ff", 0.7);
      }
    } else if (t === "crisalida") {
      const img = jefe.imago ? banco.imago(jefe.cuadro, blanco, fase) : banco.crisalida(jefe.cuadro, blanco, fase);
      ex.globalAlpha = muere(1.4);
      if (!jefe.imago) { ex.fillStyle = fase >= 5 ? "#ffd070" : fase === 4 ? "#8fd8ff" : fase === 3 ? "#c87c3c" : fase === 2 ? "#ac6c7a" : "#c8bcb0"; ex.fillRect(Math.floor(jefe.x), 0, 1, Math.max(0, Math.floor(jefe.y - 24 * e))); }   // el hilo del que cuelga
      pintaCuerpo(img, jefe.x, jefe.y);
      ex.globalAlpha = 1;
      if (jefe.marcasHilo) { lx.fillStyle = "#f2ece2"; for (const x of jefe.marcasHilo) for (let y = 40; y < H; y += 8) { lx.globalAlpha = 0.45; lx.fillRect(Math.floor(x), y, 1, 3); } lx.globalAlpha = 1; }
      // El Capullo de seda: una vuelta de hilo por cada tres capas que le quedan.
      if (jefe.seda > 0) {
        const capas = Math.ceil(jefe.seda / 3), rx = (jefe.imago ? 31 : 15) * e, ry = (jefe.imago ? 19 : 23) * e;
        ex.fillStyle = "#f2ece2";
        // Un velo sobre el cuerpo (más tupido cuantas más capas) y, encima, las vueltas de hilo.
        ex.globalAlpha = Math.min(0.5, 0.14 * capas);
        for (let y = -Math.floor(ry); y <= ry; y++) { if ((y + Math.floor(tMusica * 6)) & 1) continue; const w = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry))); ex.fillRect(Math.floor(jefe.x) - w, Math.floor(jefe.y) + y, w * 2 + 1, 1); }
        ex.globalAlpha = 0.95;
        for (let c = 0; c < capas; c++) for (let i = 0; i < 56; i++) {
          if ((i + c) % 4 === 3) continue;
          const a = (i / 56) * Math.PI * 2 + tMusica * (c % 2 ? 0.8 : -0.8);
          ex.fillRect(Math.floor(jefe.x + Math.cos(a) * (rx + 3 + c * 3)), Math.floor(jefe.y + Math.sin(a) * (ry + 3 + c * 3)), 2, 2);
        }
        ex.globalAlpha = 1;
        brillo(jefe.x, jefe.y, ry + 8, "#f2ece2", 0.12 * capas);
      }
      // El Telar: primero la marca de dónde nace la red; después, la red.
      if (jefe.redAviso != null) { lx.fillStyle = "#f2ece2"; for (let x = 2; x < W; x += 8) { lx.globalAlpha = 0.5; lx.fillRect(x, Math.floor(jefe.redAviso), 3, 1); } lx.globalAlpha = 1; }
      const r = jefe.red;
      if (r) {
        const y = Math.floor(r.y);
        for (let i = 0; i < 20; i++) if (r.segs[i]) {
          ex.fillStyle = "#f2ece2"; ex.globalAlpha = 0.85; ex.fillRect(i * 12, y, 12, 1);
          ex.fillStyle = "#c8bcb0"; ex.fillRect(i * 12 + 5, y - 2, 1, 5); ex.fillRect(i * 12, y + 2, 1, 2); ex.fillRect(i * 12 + 11, y - 3, 1, 2);
        }
        ex.globalAlpha = 1;
      }
    } else if (t === "hoguera") {
      const img = banco.hoguera(jefe.cuadro, blanco, fase);
      ex.globalAlpha = muere(2);
      const x0 = jefe.x - 30 * e, y0 = Math.floor(jefe.y - 22 * e), pie = (fase >= 2 ? 41 : 36) * e;
      pintaCuerpo(img, jefe.x, jefe.y);
      // Las llamas, vivas: lenguas que bajan hacia el fanal (la Hoguera arde hacia ti).
      const fuerza = jefe.muerto ? Math.max(0, 1 - jefe.muerto / 1.5) : 1;
      for (let i = 0; i < 14; i++) {
        const fx0 = x0 + (6 + i * 3.6) * e, largo = (6 + 5 * Math.abs(Math.sin(tMusica * 6 + i * 1.7))) * fuerza * e;
        ex.fillStyle = fase >= 5 ? "#ffb040" : fase === 4 ? "#5a6ee0" : fase === 3 ? "#ffb84c" : "#ff6a20"; ex.fillRect(Math.floor(fx0), Math.floor(y0 + pie), 2, Math.floor(largo));
        ex.fillStyle = fase >= 5 ? "#fff2c8" : fase === 4 ? "#c8f0ff" : fase === 3 ? "#fffaf0" : "#ffd070"; ex.fillRect(Math.floor(fx0), Math.floor(y0 + pie), 1, Math.floor(largo * 0.6));
      }
      ex.globalAlpha = 1;
      for (const o of jefe.orbita || []) if (o.viva) {
        const { x: ox, y: oy } = posPreso(o), l = o.lanz;
        if (jefe.muerto) ex.globalAlpha = Math.max(0, 1 - jefe.muerto / 6);
        // La Honda: el que va a arrojar tiembla y se pone al blanco; en el aire, una línea marca dónde cae.
        if (l && l.etapa === "vuela") { lx.fillStyle = "#ffd070"; for (let k = 0.1; k < 1; k += 0.12) { lx.globalAlpha = 0.5; lx.fillRect(Math.floor(lerp(ox, l.tx, k)), Math.floor(lerp(oy, M.Y_FANAL - 5, k)), 1, 1); } lx.globalAlpha = 0.8; lx.fillRect(Math.floor(l.tx) - 5, M.Y_FANAL + 5, 11, 1); lx.globalAlpha = 1; }
        ex.drawImage(banco.fanalito(l && l.etapa === "carga" && Math.floor(l.t * 16) & 1), Math.floor(ox - 3), Math.floor(oy - 3));
        ex.fillStyle = jefe.muerto ? "#ffd070" : "#ff6a20"; ex.fillRect(Math.floor(ox) - 1, Math.floor(oy) - 5 - (Math.sin(tMusica * 12 + o.f) > 0 ? 1 : 0), 3, 2);  // arde (al soltarse, su propia llama)
        if (l) brillo(ox, oy, 12, "#ffd070", 0.7);
        ex.globalAlpha = 1;
      }
      // Los Tizones: la marca en el agua y, después, lo que queda ardiendo.
      if (jefe.tizones && !jefe.muerto) {
        lx.fillStyle = "#ff8a3a";
        for (const x of jefe.tizones) { for (let y = Math.floor(jefe.y + 30); y < M.Y_FANAL; y += 7) { lx.globalAlpha = 0.4; lx.fillRect(Math.floor(x), y, 1, 2); } lx.globalAlpha = 0.5 + 0.4 * Math.sin(tMusica * 18); lx.fillRect(Math.floor(x) - 8, M.Y_FANAL + 5, 17, 1); lx.fillRect(Math.floor(x) - 8, M.Y_FANAL + 2, 1, 3); lx.fillRect(Math.floor(x) + 8, M.Y_FANAL + 2, 1, 3); }
        lx.globalAlpha = 1;
      }
      for (const c of jefe.charcos || []) {
        const vivo = Math.min(1, c.t / 0.7, (c.dur - c.t) / 0.25);
        for (let dx = -7; dx <= 6; dx += 2) {
          const h = Math.round((4 + 5 * Math.abs(Math.sin(tMusica * 9 + dx * 1.3 + c.x))) * vivo);
          ex.fillStyle = "#ff6a20"; ex.fillRect(Math.floor(c.x) + dx, M.Y_FANAL + 5 - h, 2, h);
          ex.fillStyle = "#ffd070"; ex.fillRect(Math.floor(c.x) + dx, M.Y_FANAL + 5 - Math.round(h * 0.5), 1, Math.round(h * 0.5));
        }
        brillo(c.x, M.Y_FANAL, 16, "#ff8a3a", 0.5 * vivo);
      }
    } else if (t === "luna") {
      const llena = jefe.llena || 0, nueva = jefe.nueva || 0;
      const img = banco.luna(jefe.cuadro, blanco, fase, llena > 0.5);
      ex.globalAlpha = muere(1.6) * (1 - nueva * 0.82);
      pintaCuerpo(img, jefe.x, jefe.y);
      ex.globalAlpha = 1;
      // El hueco del creciente que viene: dos líneas punteadas.
      if (jefe.pistaAng != null && !jefe.muerto) {
        lx.fillStyle = "#c8d8f0";
        for (const ang of [jefe.pistaAng - 0.14, jefe.pistaAng + 0.14]) for (let d = 22; d < 300; d += 7) { lx.globalAlpha = 0.5; lx.fillRect(Math.floor(jefe.x + Math.sin(ang) * d), Math.floor(jefe.y + 14 + Math.cos(ang) * d), 1, 2); }
        lx.globalAlpha = 1;
      }
      // La Luna llena: un halo que se cierra mientras se llena y late mientras hace de espejo.
      if (llena > 0 && !jefe.muerto) {
        lx.strokeStyle = "#fff8e8"; lx.lineWidth = 1; lx.globalAlpha = 0.8 * llena;
        lx.beginPath(); lx.arc(jefe.x, jefe.y, (jefe.espejo ? 24 + Math.sin(tMusica * 8) * 1.5 : 24 + (1 - llena) * 22) * e, 0, Math.PI * 2); lx.stroke();
        lx.globalAlpha = 1;
        brillo(jefe.x, jefe.y, 34 * e, "#fff8e8", 0.45 * llena);
      }
      // La Resaca de luz: el agua, encendida.
      if ((jefe.resaca > 0 || jefe.resacaAviso) && !jefe.muerto) {
        lx.fillStyle = "#c8d8f0";
        for (let x = 0; x < W; x += 2) { const h = 3 + Math.round(1.5 * Math.sin(x * 0.2 + tMusica * 5)); lx.globalAlpha = jefe.resacaAviso ? 0.3 + 0.25 * Math.sin(tMusica * 16) : 0.4 * Math.min(1, jefe.resaca); lx.fillRect(x, H - h, 2, h); }
        lx.globalAlpha = 1;
      }
    } else if (t === "constelacion") {
      ex.globalAlpha = muere(1.8);
      const pos = jefe.hermanas.map(posHermana);
      // La figura: líneas tenues entre hermanas, y la que van trazando, encendida.
      for (let i = 1; i < pos.length; i++) linea(ex, pos[i - 1], pos[i], fase >= 5 ? "#ff8cb4" : fase === 4 ? "#5a6ee0" : fase === 3 ? "#2a3a7a" : fase === 2 ? "#5c1222" : "#3a2e6a", 0.6);
      if (jefe.trazo) for (let i = 1; i < jefe.trazo.length; i++) linea(lx, pos[jefe.trazo[i - 1]], pos[jefe.trazo[i]], "#fff0c8", 0.8);
      jefe.hermanas.forEach((h, i) => {
        const v = h.nova;
        pintaCuerpo(banco.hermana(jefe.cuadro + i, h.velada, blanco || h.flash > 0 || (v && Math.sin(v.t * (6 + 20 * v.t / v.dur)) > 0.6), fase), pos[i].x, pos[i].y);
        // La Supernova: un anillo rojo que se cierra sobre la que va a estallar, y los golpes que pide.
        if (v && !jefe.muerto) {
          const q = v.t / v.dur;
          lx.strokeStyle = "#ff5c3c"; lx.lineWidth = 1; lx.globalAlpha = 0.9;
          lx.beginPath(); lx.arc(pos[i].x, pos[i].y, 9 + (1 - q) * 26, 0, Math.PI * 2); lx.stroke();
          lx.globalAlpha = 1;
          brillo(pos[i].x, pos[i].y, 12 + q * 10, "#ff5c3c", 0.5 + 0.4 * q);
          ex.fillStyle = "#ff5c3c";
          for (let k = 0; k < v.pide - v.golpes; k++) ex.fillRect(Math.floor(pos[i].x - (v.pide - v.golpes) * 1.5 + k * 3), Math.floor(pos[i].y - 14 * e), 2, 2);
        }
      });
      ex.globalAlpha = 1;
      if (jefe.marcaX != null && !jefe.muerto) { lx.fillStyle = "#d8c8ff"; for (let y = 40; y < H; y += 6) { lx.globalAlpha = 0.5; lx.fillRect(Math.floor(jefe.marcaX), y, 1, 2); } lx.globalAlpha = 1; }
    } else if (t === "sol") {
      const img = banco.sol(jefe.cuadro, blanco, fase), cierra = jefe.colapso || 1;
      const vivo = muere(2.2);
      // Los rayos largos, que giran despacio (cuando se cierra, se recogen).
      lx.fillStyle = fase >= 5 ? "#fff2c8" : fase === 4 ? "#c8f0ff" : fase === 3 ? "#fff2b4" : "#ffe6a0";
      for (let i = 0; i < 12; i++) {
        const ang = tMusica * 0.15 + (i / 12) * Math.PI * 2;
        for (let d = 30 * e * cierra; d < 70 * e * cierra; d += 2) { lx.globalAlpha = 0.22 * vivo * (1 - (d - 30 * e * cierra) / (40 * e * cierra)); lx.fillRect(Math.floor(jefe.x + Math.cos(ang) * d), Math.floor(jefe.y + Math.sin(ang) * d), 1, 1); }
      }
      lx.globalAlpha = 1;
      if (jefe.muerto) {
        // Se apaga achicándose hasta caber en un vidrio: adentro había un fanal.
        const k = Math.max(0.08, 1 - jefe.muerto / 1.8), w = Math.round(img.width * k), h = Math.round(img.height * k);
        ex.globalAlpha = Math.min(1, vivo * 1.6);
        ex.drawImage(img, Math.floor(jefe.x - w / 2), Math.floor(jefe.y - h / 2), w, h);
        const f = clamp((jefe.muerto - 0.9) / 0.9, 0, 1);
        if (f > 0) {
          const fan = banco.fanalito();
          ex.globalAlpha = f; ex.drawImage(fan, Math.floor(jefe.x - fan.width / 2), Math.floor(jefe.y - fan.height / 2));
          brillo(jefe.x, jefe.y, 10 + 8 * (1 - f), "#ffd070", 0.5 * f);
        }
      } else {
        ex.globalAlpha = vivo;
        pintaCuerpo(img, jefe.x, jefe.y, cierra);
        if (cierra < 1) brillo(jefe.x, jefe.y, 26 * e, "#ffffff", 1 - cierra);   // el Colapso: cuanto más chico, más blanco
      }
      ex.globalAlpha = 1;
      // El eclipse: la Luna pasa por delante.
      if (jefe.eclipse != null) {
        const mx = jefe.x + lerp(-46, 46, jefe.eclipse) * e;
        ex.fillStyle = "#3e4a62"; ex.beginPath(); ex.arc(mx, jefe.y, 20 * e, 0, Math.PI * 2); ex.fill();
        ex.fillStyle = "#1a2236"; ex.beginPath(); ex.arc(mx, jefe.y, 18.5 * e, 0, Math.PI * 2); ex.fill();
      }
      // La Canícula: el aire que tiembla, de abajo arriba.
      if ((jefe.canicula > 0 || jefe.caniculaAviso) && !jefe.muerto) {
        lx.fillStyle = "#ff9a3c";
        for (let i = 0; i < 26; i++) { const x = (i * 37 + Math.floor(tMusica * 3) * 13) % W, y = H - ((tMusica * 50 + i * 53) % 200); lx.globalAlpha = (jefe.caniculaAviso ? 0.5 : 0.28) * (1 - (H - y) / 200); lx.fillRect(Math.floor(x + Math.sin(y * 0.1 + i) * 2), Math.floor(y), 1, 4); }
        lx.globalAlpha = 1;
      }
    } else if (t === "alba") {
      const esc = escalaAlba(), img = banco.fanal(true);
      const w = img.width * esc, h = img.height * esc;
      ex.drawImage(img, Math.floor(jefe.x - w / 2), Math.floor(jefe.y - h / 2), w, h);
      // Su llama, del revés: cuelga debajo del vidrio.
      const fy = jefe.y + (h / 2) - 4.5 * esc, fxp = Math.floor(jefe.x);
      ex.fillStyle = "#fffaf0"; ex.fillRect(fxp - Math.floor(esc / 2), Math.floor(fy), esc, 2 * esc);
    }
    dibujaColumnas();
    if (fase >= 4 && !jefe.muerto) dibujaFase4();
    if (fase >= 5 && !jefe.muerto) dibujaFase5();
    if (fase >= 6 && !jefe.muerto) { dibujaMuda(); dibujaFase6(); }
    if (fase >= 7 && !jefe.muerto) dibujaFase7();
  }
  /* El cuerpo de un jefe centrado en (cx, cy). El dibujo ya viene a su
     tamaño; `esc` es solo para el Sol cuando se cierra. */
  function pintaCuerpo(img, cx, cy, esc) {
    const w = Math.round(img.width * (esc || 1)), h = Math.round(img.height * (esc || 1));
    ex.drawImage(img, Math.floor(cx - w / 2), Math.floor(cy - h / 2), w, h);
  }
  /* Las balizas del Faro (fase 2): la boya y su haz corto, que gira. Antes
     de encenderse se ve punteado; un casco lo corta. */
  function dibujaBalizas() {
    for (const z of jefe.balizas || []) {
      const x = Math.floor(z.x), y = Math.floor(z.y), enc = z.t >= 1.4, ux = Math.sin(z.a), uy = Math.cos(z.a);
      lx.fillStyle = "#ffd884";
      for (let d = 5; d < LARGO_BALIZA; d += enc ? 1 : 5) {
        const px = z.x + ux * d, py = z.y + uy * d;
        if (naufragioEn(px, py)) break;
        lx.globalAlpha = enc ? 0.8 * (1 - (d / LARGO_BALIZA) * 0.5) : 0.4;
        lx.fillRect(Math.floor(px), Math.floor(py), enc ? 2 : 1, enc ? 2 : 1);
      }
      lx.globalAlpha = 1;
      ex.fillStyle = "#5e2618"; ex.fillRect(x - 3, y - 3, 7, 7);
      ex.fillStyle = "#b4542c"; ex.fillRect(x - 3, y - 4, 7, 1); ex.fillRect(x - 3, y + 3, 7, 1); ex.fillRect(x, y - 6, 1, 2);
      ex.fillStyle = enc ? "#ffd884" : "#8c3c2c"; ex.fillRect(x - 1, y - 1, 3, 3);
      ex.fillStyle = "#ffd884"; for (let i = 0; i < z.vida; i++) ex.fillRect(x - 3 + i * 3, y + 5, 2, 1);   // los tiros que le faltan
    }
  }
  /* Las columnas de fuego de la Hoguera, los rayos del Sol y los rayos
     finos de las Siete Hermanas en fila: primero la marca, después el fuego. */
  function dibujaColumnas() {
    for (const c of columnas) {
      if (c.fino) {
        if (c.aviso) { lx.fillStyle = "#d8c8ff"; for (let y = 76; y < H; y += 6) { lx.globalAlpha = 0.5; lx.fillRect(Math.floor(c.x), y, 1, 2); } lx.globalAlpha = 1; }
        else {
          for (let y = 74; y < H; y += 2) { ex.fillStyle = (y + Math.floor(tMusica * 60)) % 6 < 3 ? "#b08aff" : "#d8c8ff"; ex.fillRect(Math.floor(c.x) - 2, y, 5, 2); }
          ex.fillStyle = "#ffffff"; ex.fillRect(Math.floor(c.x), 74, 1, H - 74);
        }
        continue;
      }
      const frio = !!jefe && jefe.fase === 4;                              // en la fase 4 la Hoguera y el Sol arden en frío
      if (c.aviso) { lx.fillStyle = frio ? "#8fd8ff" : c.sol ? "#ffe6a0" : "#ff8a3a"; for (let y = 50; y < H; y += 6) { lx.globalAlpha = 0.55; lx.fillRect(Math.floor(c.x) - 7, y, 1, 2); lx.fillRect(Math.floor(c.x) + 7, y, 1, 2); } lx.globalAlpha = 1; }
      else {
        const [a, b, n] = frio ? ["#3c50b4", "#8fd8ff", "#ffffff"] : c.sol ? ["#ffd070", "#fff0b0", "#ffffff"] : ["#ff6a20", "#ffb040", "#fff0b0"];
        for (let y = 70; y < H; y += 2) { ex.fillStyle = (y + Math.floor(tMusica * 60)) % 6 < 3 ? a : b; ex.fillRect(Math.floor(c.x - 5 + Math.sin(y * 0.2 + tMusica * 20) * 1.5), y, 11, 2); }
        ex.fillStyle = n; ex.fillRect(Math.floor(c.x) - 1, 70, 3, H - 70);
      }
    }
  }
  /* Una línea de píxeles de `p` a `q` (la figura de las Siete Hermanas). */
  function linea(ctx, p, q, color, a) {
    const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 2));
    ctx.fillStyle = color; ctx.globalAlpha = a;
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.floor(lerp(p.x, q.x, i / n)), Math.floor(lerp(p.y, q.y, i / n)), 1, 1);
    ctx.globalAlpha = 1;
  }
  /* El haz del Faro: un abanico de luz con sombras detrás de los cascos.
     Antes de encenderse se anuncia con una línea punteada. */
  function dibujaHaz() {
    const hz = jefe.haz;
    if (!hz) return;
    const ox = jefe.x, oy = jefe.y + 1, L = 420;
    if (hz.aviso) {
      // El aviso: dos líneas punteadas, donde empieza y donde termina el barrido.
      lx.fillStyle = "#e6f6dc";
      hz.angs.concat(hz.fin || []).forEach((ang, i) => {
        const inicio = i < hz.angs.length;
        for (let d = 14; d < 320; d += inicio ? 6 : 10) { lx.globalAlpha = inicio ? 0.6 : 0.35; lx.fillRect(Math.floor(ox + Math.sin(ang) * d), Math.floor(oy + Math.cos(ang) * d), 1, 1); }
      });
      lx.globalAlpha = 1;
      return;
    }
    for (const ang of hz.angs) {
      // En el Giro entero (fase 3) el parpadeo no esconde el haz: queda punteado, para saber por dónde va.
      if (hz.apagado && hz.giro) { lx.fillStyle = "#e6f6dc"; for (let d = 14; d < 320; d += 7) { lx.globalAlpha = 0.45; lx.fillRect(Math.floor(ox + Math.sin(ang) * d), Math.floor(oy + Math.cos(ang) * d), 1, 2); } lx.globalAlpha = 1; }
      if (hz.apagado) continue;
      const a1 = ang - 0.075, a2 = ang + 0.075;
      lx.save(); lx.globalCompositeOperation = "lighter"; lx.globalAlpha = 0.32; lx.fillStyle = "#e6f6dc";
      lx.beginPath(); lx.moveTo(ox, oy); lx.lineTo(ox + Math.sin(a1) * L, oy + Math.cos(a1) * L); lx.lineTo(ox + Math.sin(a2) * L, oy + Math.cos(a2) * L); lx.closePath(); lx.fill();
      // La sombra de cada casco: un cuadrilátero que sale de su borde superior.
      lx.globalCompositeOperation = "destination-out"; lx.globalAlpha = 1; lx.fillStyle = "#000";
      for (const n of naufragios) {
        const xa = n.x + 1, xb = n.x + n.w - 1, y0 = n.y + 1;
        const pa = proyecta(ox, oy, xa, y0), pb = proyecta(ox, oy, xb, y0);
        lx.beginPath(); lx.moveTo(xa, y0); lx.lineTo(xb, y0); lx.lineTo(pb[0], pb[1]); lx.lineTo(pa[0], pa[1]); lx.closePath(); lx.fill();
      }
      lx.restore();
      jefe.hazLuz = true;
    }
  }
  const proyecta = (ox, oy, x, y) => { const k = (H + 20 - oy) / Math.max(1, y - oy); return [ox + (x - ox) * k, oy + (y - oy) * k]; };

  function dibujaFanal() {
    if (!F) return;
    const x = Math.floor(F.x), y = M.Y_FANAL;
    const parpadea = F.invul > 0 && !F.apagado && Math.floor(F.invul * 14) % 2 === 0;
    if (!parpadea) {
      // Los remos: dos trazos que se mueven cuando la barca avanza.
      const r = Math.sin(F.remo * 6), lado = F.vx > 4 ? 1 : F.vx < -4 ? -1 : 0;
      ex.fillStyle = "#4a3222";
      for (const s of [-1, 1]) {
        const y0 = y + 2, x0 = x + s * 7, pal = Math.round(r * (lado === s ? 2 : 1));
        ex.fillRect(x0 + s * 1, y0, 1, 1); ex.fillRect(x0 + s * 2, y0 + 1 + pal, 1, 1); ex.fillRect(x0 + s * 3, y0 + 2 + pal, 2, 1);
      }
      ex.drawImage(banco.fanal(false, F.invul > 1.9, P ? M.evolucion(P.mej, "nave") : 0), x - 7, y - 5);
      // La llama: tres colores que tiemblan dentro del vidrio.
      if (!F.apagado || F.apagado < 1.4) {
        const alto = F.apagado ? Math.max(0, 3 - Math.floor(F.apagado * 2.5)) : 2 + (Math.sin(tMusica * 17) > 0.2 ? 1 : 0) + (pulsoLuz > 0.6 ? 1 : 0);
        const lx0 = x, ly0 = y - 5 + S.LLAMA.y;
        if (alto > 0) {
          ex.fillStyle = P && P.llamas === 1 ? "#a8c8ff" : "#ff9a3c"; ex.fillRect(lx0 - 1, ly0 - alto + 1, 3, alto);
          ex.fillStyle = "#ffcf6b"; ex.fillRect(lx0, ly0 - alto + 1, 1, alto);
          ex.fillStyle = "#fff6d8"; ex.fillRect(lx0, ly0, 1, 1);
          if (alto >= 3) { ex.fillStyle = "#ffcf6b"; ex.fillRect(lx0, ly0 - alto, 1, 1); }
        }
      }
      if (F.campana > 0) { ex.strokeStyle = "rgba(232,220,196,.65)"; ex.lineWidth = 1; ex.beginPath(); ex.arc(x + 0.5, y - 2, 10, Math.PI, 0); ex.stroke(); }
      if (F.enredo > 0) { ex.fillStyle = "rgba(242,236,226,.8)"; ex.fillRect(x - 8, y + 1, 1, 3); ex.fillRect(x + 8, y + 1, 1, 3); ex.fillRect(x - 6, y + 3, 13, 1); }   // seda en los remos
      if (F.mudo > 0) { ex.fillStyle = "rgba(242,236,226,.9)"; ex.fillRect(x - 4, y - 8, 9, 1); ex.fillRect(x - 5, y - 6, 11, 1); ex.fillRect(x - 4, y - 4, 9, 1); }   // y en la mecha: la red de la Crisálida
      // La Mortaja de la Crisálida (fase 4): envuelto; arriba, las vueltas que faltan cortar.
      if (F.capullo > 0) {
        ex.fillStyle = "rgba(242,236,226,.95)";
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + tMusica * 2; ex.fillRect(Math.floor(x + Math.cos(a) * 10), Math.floor(y - 3 + Math.sin(a) * 9), 2, 1); }
        for (let i = 0; i < F.capullo; i++) ex.fillRect(Math.floor(x - F.capullo * 1.5 + i * 3), y - 17, 2, 2);
        if (F.capT < 1 && Math.floor(tMusica * 12) & 1) { ex.fillStyle = "#ff5c3c"; ex.fillRect(x - 7, y - 20, 15, 1); }
      }
      // El Abrazo de la Nodriza (fase 5): las polillas que se posaron.
      for (let i = 0; i < Math.min(5, F.posadas || 0); i++) ex.drawImage(banco.mini(1, (Math.floor(tMusica * 10) + i) & 1, true), Math.floor(x - 3 + [-7, 6, -4, 3, 0][i]), Math.floor(y - [3, 2, 9, 10, 14][i]));
      // La Canícula del Sol: el vidrio se calienta si no remas. Una barra sobre el fanal, y el vidrio al rojo.
      if (F.calor > 0.02) {
        ex.fillStyle = "#3a0a08"; ex.fillRect(x - 6, y - 14, 13, 3);
        ex.fillStyle = F.calor > 0.7 ? (Math.floor(tMusica * 14) & 1 ? "#ffffff" : "#ff5c1c") : "#ff9a3c"; ex.fillRect(x - 5, y - 13, Math.round(11 * F.calor), 1);
        brillo(F.x, y - 4, 10 + 8 * F.calor, "#ff3a1a", F.calor * 0.9);
      }
    }
  }
  function dibujaEscamas() {
    for (const e of escamas) {
      const x = Math.floor(e.x), y = Math.floor(e.y);
      const pal = S.PALETAS[e.estilo] || S.PALETAS[1];
      if (e.fugaz) {
        if (e.espera > 0) { ex.fillStyle = Math.floor(e.espera * 12) & 1 ? "#fff8e0" : "#b08aff"; ex.fillRect(x, y - 2, 1, 5); ex.fillRect(x - 2, y, 5, 1); continue; }
        const v = Math.hypot(e.vx, e.vy) || 1, ux = e.vx / v, uy = e.vy / v, L = e.grande ? 14 : 8;
        for (let k = L; k > 0; k--) { ex.fillStyle = k < 3 ? "#fff8e0" : k < 6 ? "#d8c8ff" : "#6a5aa8"; ex.fillRect(Math.floor(e.x - ux * k), Math.floor(e.y - uy * k), e.grande && k < 6 ? 2 : 1, 1); }
        ex.fillStyle = "#ffffff"; ex.fillRect(x - (e.grande ? 1 : 0), y - (e.grande ? 1 : 0), e.grande ? 3 : 2, e.grande ? 3 : 2);
        continue;
      }
      if (e.devuelta) { ex.fillStyle = "#fff6d8"; ex.fillRect(x - 1, y - 1, 3, 3); ex.fillStyle = "#ffd27a"; ex.fillRect(x, y - 3, 1, 2); continue; }
      // La fase 7: una hoja de pan de oro (gira: ancha o de canto), una escama del Halo o de las Grietas.
      // Mientras esperan, titilan.
      if ((e.hoja || e.halo || e.oro) && e.espera > 0 && Math.floor(e.espera * 14) & 1) { ex.fillStyle = "#fff0b0"; ex.fillRect(x, y, 1, 1); continue; }
      if (e.hoja) { const ancha = Math.cos(e.t * e.fr * 2 + e.ph) > 0; ex.fillStyle = "#b87828"; ex.fillRect(x - (ancha ? 2 : 0), y - 1, ancha ? 5 : 1, 3); ex.fillStyle = "#ffd070"; ex.fillRect(x - (ancha ? 1 : 0), y - 1, ancha ? 3 : 1, 2); ex.fillStyle = "#fff0b0"; ex.fillRect(x, y - 1, 1, 1); continue; }
      if (e.halo || e.oro) { ex.fillStyle = "#b87828"; ex.fillRect(x - 1, y - 1, 3, 3); ex.fillStyle = e.halo ? "#ffd070" : "#fff0b0"; ex.fillRect(x - 1, y, 3, 1); ex.fillRect(x, y - 1, 1, 3); brillo(e.x, e.y, 6, "#ffd070", 0.35); continue; }
      // De las habilidades de fase: polvo suspendido (Nodriza), lo que vuelve del agua (Luna), un tizón (Hoguera).
      // Una luz del Prisma (Faro, fase 5): grande y tornasolada.
      if (e.vidrio) { ex.fillStyle = "#140c1c"; ex.fillRect(x - 2, y - 2, 5, 5); ex.fillStyle = JOYAS[(Math.round(e.x / 24) & 3)]; ex.fillRect(x - 1, y - 2, 3, 5); ex.fillRect(x - 2, y - 1, 5, 3); ex.fillStyle = "#fff6d8"; ex.fillRect(x - 1, y - 1, 1, 1); continue; }   // un vidrio de la Muda o la Celosía (fase 6)
      if (e.prisma) { ex.fillStyle = "#ffffff"; ex.fillRect(x - 1, y - 3, 3, 7); ex.fillRect(x - 3, y - 1, 7, 3); ex.fillStyle = Math.floor(e.t * 8) & 1 ? "#ff8cb4" : "#8fd8ff"; ex.fillRect(x - 1, y - 1, 3, 3); brillo(e.x, e.y, 9, "#ffc8e0", 0.45); continue; }
      if (e.polvo) { if (e.espera > 0 && Math.floor(e.espera * 14) & 1) continue; ex.fillStyle = "#e8d8c0"; ex.fillRect(x - 1, y, 3, 1); ex.fillRect(x, y - 1, 1, 3); ex.fillStyle = "#fff6e0"; ex.fillRect(x, y, 1, 1); continue; }
      if (e.reflejo) { ex.fillStyle = "#5a6e98"; ex.fillRect(x, y + 2, 1, 4); ex.fillStyle = "#c8d8f0"; ex.fillRect(x, y, 2, 2); continue; }
      if (e.tizon) { ex.fillStyle = "#5a1c12"; ex.fillRect(x - 2, y - 3, 5, 6); ex.fillStyle = "#ff6a20"; ex.fillRect(x - 1, y - 2, 3, 4); ex.fillStyle = "#ffd070"; ex.fillRect(x, y - 8, 1, 6); continue; }
      if (e.muro && e.ancho) { ex.fillStyle = pal.escama[1]; ex.fillRect(x - 6, y - 1, 12, 3); ex.fillStyle = pal.escama[0]; ex.fillRect(x - 5, y, 10, 1); continue; }
      if (e.muro) { ex.fillStyle = pal.escama[1]; ex.fillRect(x - 2, y - 1, 5, 3); ex.fillStyle = pal.escama[0]; ex.fillRect(x - 1, y, 3, 1); continue; }
      if (e.pecio) { ex.fillStyle = "#5a4a3a"; ex.fillRect(x - 3, y - 1, 7, 3); ex.fillStyle = "#8a6a3a"; ex.fillRect(x - 2, y - 2, 5, 1); continue; }
      if (e.burbuja) { ex.fillStyle = "#d0f0e8"; ex.fillRect(x - 2, y - 3, 5, 1); ex.fillRect(x - 2, y + 3, 5, 1); ex.fillRect(x - 3, y - 2, 1, 5); ex.fillRect(x + 3, y - 2, 1, 5); ex.fillRect(x - 1, y - 1, 1, 1); continue; }
      if (e.ascua) { ex.fillStyle = "#ff6a20"; ex.fillRect(x - 1, y - 1, 3, 3); ex.fillStyle = "#fff0b0"; ex.fillRect(x, y, 1, 1); continue; }
      ex.fillStyle = pal.escama[0];
      if (e.estilo === 1) { ex.fillRect(x, y - 2, 1, 1); ex.fillRect(x + ((Math.floor(e.t * 18) & 1) ? 1 : -1), y - 1, 1, 1); ex.fillRect(x, y, 1, 1); ex.fillRect(x + ((Math.floor(e.t * 18) & 1) ? -1 : 1), y + 1, 1, 1); }
      else if (e.estilo === 2) { ex.fillRect(x, y - 2, 1, 2); ex.fillRect(x - 1, y, 3, 2); }
      else { ex.fillRect(x, y, 2, 2); ex.fillStyle = pal.escama[1]; ex.fillRect(x - 2, y - 2, 1, 1); ex.fillRect(x + 3, y - 1, 1, 1); }
    }
  }
  function dibujaBalas() {
    for (const b of balas) {
      const x = Math.floor(b.x), y = Math.floor(b.y);
      if (b.chispa) { ex.fillStyle = "#ffb040"; ex.fillRect(x, y, 1, 3); ex.fillStyle = "#fff6d8"; ex.fillRect(x, y, 1, 1); continue; }
      if (b.rayo) { ex.fillStyle = "#e8f6ff"; ex.fillRect(x - 1, y - 2, 3, 12); ex.fillStyle = "#ffffff"; ex.fillRect(x, y - 4, 1, 16); continue; }   // el Faro: el tiro afinado es un rayo
      if (b.evo >= 4) { ex.fillStyle = "#fff6d8"; ex.fillRect(x - 1, y + 1, 3, 1); ex.fillRect(x, y - 1, 1, 5); }   // la Estrella: cada tiro, una cruz de luz
      if (b.afinado) { ex.fillStyle = "#ffd27a"; ex.fillRect(x - 1, y, 3, 4); ex.fillStyle = "#fff6d8"; ex.fillRect(x, y - 1, 1, 6); ex.fillStyle = "#ff9a3c"; ex.fillRect(x, y + 5, 1, 3); }
      else { ex.fillStyle = F && F.lente > 0 ? "#bfe8ff" : "#ffe6a8"; ex.fillRect(x, y, 1, 5); ex.fillStyle = "#fff6d8"; ex.fillRect(x, y, 1, 2); }
    }
  }
  function dibujaParticulas() {
    for (const q of particulas) {
      const a = clamp(q.vida / q.max, 0, 1);
      if (q.tipo === "anillo") {
        lx.strokeStyle = q.col; lx.globalAlpha = a; lx.lineWidth = 1;
        lx.beginPath(); lx.arc(q.x, q.y, (1 - a) * q.r + 2, 0, Math.PI * 2); lx.stroke(); lx.globalAlpha = 1;
        continue;
      }
      ex.globalAlpha = q.tipo === "humo" ? a * 0.6 : q.tipo === "viento" ? a * 0.35 : a;
      ex.fillStyle = q.col;
      ex.fillRect(Math.floor(q.x), Math.floor(q.y), q.tipo === "humo" ? 2 : q.tipo === "viento" ? 4 : 1, 1);
    }
    ex.globalAlpha = 1;
  }
  function dibujaMenores() {
    for (const l of larvas) if (l.vida > 0) {
      if (l.abrazo) { ex.drawImage(banco.mini(1, Math.floor(l.t * 8) & 1, true), Math.floor(l.x - 3), Math.floor(l.y - 2)); brillo(l.x, l.y, 10, "#ffd070", 0.55); continue; }
      if (!l.huevo) { ex.drawImage(banco.mini(l.acto || 1, Math.floor(l.t * 10) & 1), Math.floor(l.x - 3), Math.floor(l.y - 2)); continue; }
      // Un huevo de la Nidada: late más rápido cuanto menos le falta.
      const x = Math.floor(l.x), y = Math.floor(l.y), q = Math.min(1, l.t / l.huevo), late = Math.sin(l.t * (5 + q * 26)) > 0;
      ex.fillStyle = "#7c2c30"; ex.fillRect(x - 3, y - 4, 7, 9); ex.fillRect(x - 4, y - 2, 9, 5);
      ex.fillStyle = late ? "#fff2c0" : "#ffb468"; ex.fillRect(x - 2, y - 3, 5, 7); ex.fillRect(x - 3, y - 1, 7, 3);
      ex.fillStyle = "#4c111e"; ex.fillRect(x - 1, y - 1 + (late ? 0 : 1), 2, 3);
      brillo(l.x, l.y, 9 + q * 7, "#ffb468", 0.3 + q * 0.5);
    }
    // Los hilos de seda: una línea pálida que tiembla un poco.
    for (const h of hilos) {
      const a = Math.min(1, h.t * 3, (h.dur - h.t) * 2);
      ex.globalAlpha = 0.55 * a; ex.fillStyle = "#f2ece2";
      for (let y = Math.floor(h.y0); y < h.y0 + h.largo; y += 2) ex.fillRect(Math.floor(h.x + Math.sin(y * 0.08 + h.t * 3) * 0.8), y, 1, 2);
      ex.globalAlpha = 1;
    }
    // El ancla del Casco: la cadena y el ancla.
    for (const n of anclas) {
      if (jefe) { ex.fillStyle = "#5a4a3a"; for (let y = Math.floor(jefe.y + 16); y < n.y - 4; y += 3) ex.fillRect(Math.floor(n.x), y, 1, 2); }
      // La Cadena (fase 2): clavada, sus eslabones se ven gruesos; parpadea cuando está por subir.
      if (n.plantada > 0 && (n.plantada > 1 || Math.floor(n.plantada * 10) & 1)) { for (let y = 150; y < n.y - 4; y += 4) { ex.fillStyle = (y >> 2) & 1 ? "#c89a52" : "#8a6a3a"; ex.fillRect(Math.floor(n.x) - 1, y, 3, 3); } brillo(n.x, 250, 26, "#c89a52", 0.25); }
      const x = Math.floor(n.x), y = Math.floor(n.y);
      ex.fillStyle = "#8a6a3a"; ex.fillRect(x, y - 6, 1, 10); ex.fillRect(x - 3, y - 4, 7, 1);
      ex.fillStyle = "#c89a52"; ex.fillRect(x - 5, y + 3, 11, 1); ex.fillRect(x - 6, y + 1, 2, 2); ex.fillRect(x + 5, y + 1, 2, 2); ex.fillRect(x - 1, y - 8, 3, 2);
    }
    // Las luciérnagas (y los fanales que se soltaron de la Hoguera).
    for (const l of luciernagas) {
      ex.globalAlpha = l.cd > 0 ? 0.45 : 1;
      if (l.libre) { const img = banco.fanalito(); ex.drawImage(img, Math.floor(l.x - 3), Math.floor(l.y - 3)); }
      else { ex.fillStyle = "#fff6d8"; ex.fillRect(Math.floor(l.x), Math.floor(l.y), 1, 1); ex.fillStyle = "#ffd27a"; ex.fillRect(Math.floor(l.x) - 1, Math.floor(l.y) + 1, 3, 1); }
      ex.globalAlpha = 1;
    }
    for (const l of lumbres) if (l.viva) {
      // Las que rodean la llama en la revelación son las del faro (de la
      // niebla); las del alba brillan solas.
      const img = l.quieta ? banco.mini(2, Math.floor(tMusica * 4 + l.f) & 1) : banco.polilla(4, "a", Math.floor(tMusica * 6 + l.f) & 1);
      ex.drawImage(img, Math.floor(l.x - img.width / 2), Math.floor(l.y - img.height / 2));
    }
    for (const s of sombras) if (s.viva) {
      const img = banco.polilla(4, "b", Math.floor(s.t * 8) & 1);
      ex.drawImage(img, Math.floor(s.x - img.width / 2), Math.floor(s.y - img.height / 2));
    }
    for (const c of cenizas) {
      ex.fillStyle = "#5a5068";
      for (let yy = -c.r; yy <= c.r; yy++) for (let xx = -c.r; xx <= c.r; xx++) {
        const d = Math.hypot(xx, yy * 1.4) / c.r;
        if (d < 1 && BAYER[((Math.floor(c.y) + yy) & 3) * 4 + ((Math.floor(c.x) + xx) & 3)] < (1 - d) * 0.75) ex.fillRect(Math.floor(c.x + xx), Math.floor(c.y + yy), 1, 1);
      }
    }
    if (msj) {
      const img = banco.mensajera(Math.floor(msj.t * 6) & 1);
      ex.drawImage(img, Math.floor(msj.x - img.width / 2), Math.floor(msj.y - img.height / 2));
    }
    for (const p of poderes) { const img = banco.poder(p.tipo); ex.drawImage(img, Math.floor(p.x - 3), Math.floor(p.y - 3)); }
  }
  function dibujaAdorno() {
    for (const m of adorno) {
      const a = m.a + tMusica * m.w * 0.6, x = F.x + Math.cos(a) * m.r, y = M.Y_FANAL - 50 + Math.sin(a) * m.r * 0.55 + Math.sin(tMusica * 3 + m.f) * 3;
      const img = banco.polilla(1, m.tipo, Math.floor(tMusica * 7 + m.f) & 1);
      ex.drawImage(img, Math.floor(x - img.width / 2), Math.floor(y - img.height / 2));
    }
  }
  /* La visión del final: el cielo lleno de alas, alumbrado por dos luces. */
  function dibujaLleno() {
    const t = cielo.lleno;
    if (t <= 0) return;
    const aparecer = clamp(t / 2.5, 0, 1), irse = clamp((t - 14) / 6, 0, 1), a = aparecer * (1 - irse);
    if (a <= 0) return;
    const r = M.mulberry32(99);
    ex.globalAlpha = a;
    for (let i = 0; i < 700; i++) {
      // Alas de todos los actos, la mitad alumbradas por las dos luces.
      const x = r() * W, y = r() * H, f = r() * 6, q = r();
      const img = banco.mini(q < 0.5 ? 4 : q < 0.7 ? 1 : q < 0.85 ? 2 : 3, Math.floor(tMusica * 5 + f) & 1);
      ex.drawImage(img, Math.floor(x + Math.sin(tMusica * 0.7 + f) * 3), Math.floor(y + Math.cos(tMusica * 0.5 + f) * 2));
    }
    ex.globalAlpha = 1;
  }

  /* La oscuridad: una máscara con agujeros donde hay luz, posterizada con
     el tramado de Bayer para que también la luz tenga píxeles. */
  function dibujaOscuridad(nivel, luces) {
    const p = S.PALETAS[cielo.hacia] || S.PALETAS[1];
    sx.globalCompositeOperation = "source-over";
    sx.clearRect(0, 0, W, H);
    if (nivel <= 0.01) return false;
    sx.globalAlpha = nivel; sx.fillStyle = p.sombra; sx.fillRect(0, 0, W, H); sx.globalAlpha = 1;
    sx.globalCompositeOperation = "destination-out";
    for (const l of luces) {
      const g = sx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(0,0,0,${l.i})`); g.addColorStop(0.45, `rgba(0,0,0,${l.i * 0.8})`); g.addColorStop(1, "rgba(0,0,0,0)");
      sx.fillStyle = g; sx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    // El haz del faro también alumbra.
    if (jefe && jefe.tipo === "faro" && jefe.haz && !jefe.haz.aviso && !jefe.haz.apagado) {
      sx.fillStyle = "rgba(0,0,0,.75)";
      for (const ang of jefe.haz.angs) { const ox = jefe.x, oy = jefe.y + 1; sx.beginPath(); sx.moveTo(ox, oy); sx.lineTo(ox + Math.sin(ang - 0.08) * 420, oy + Math.cos(ang - 0.08) * 420); sx.lineTo(ox + Math.sin(ang + 0.08) * 420, oy + Math.cos(ang + 0.08) * 420); sx.closePath(); sx.fill(); }
    }
    sx.globalCompositeOperation = "source-over";
    // Posterizar: seis niveles entre la luz plena y la oscuridad del acto,
    // con el borde tramado. Se mide contra el nivel del acto y no contra el
    // negro: así la oscuridad pareja queda lisa y el tramado aparece solo
    // donde la luz se apaga (en el borde de cada círculo).
    const img = sx.getImageData(0, 0, W, H), d = img.data, tope = nivel * 255;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4 + 3, b = BAYER[(y & 3) * 4 + (x & 3)];
      d[o] = Math.min(255, (Math.floor((d[o] / tope) * 5 + b) / 5) * tope);
    }
    sx.putImageData(img, 0, 0);
    return true;
  }

  /* Junta todas las luces de este cuadro (para la oscuridad y el brillo). */
  function reuneLuces() {
    const out = [];
    if (F) out.push({ x: F.x, y: M.Y_FANAL - 6, r: radioLuz(), i: 1 });
    for (const b of balas) out.push({ x: b.x, y: b.y, r: b.afinado ? 16 : 10, i: 0.9 });
    for (const e of escamas) out.push({ x: e.x, y: e.y, r: e.muro ? 7 : 6, i: 0.7 });
    for (const d of destellos) out.push({ x: d.x, y: d.y, r: d.r * (1 - d.t / d.dur * 0.5), i: d.i * (1 - d.t / d.dur) });
    for (const p of poderes) out.push({ x: p.x, y: p.y, r: 10, i: 0.8 });
    // En lo oscuro las polillas brillan apenas, como estrellas lejanas (y es
    // que eso son, aunque todavía no se sepa).
    if (P && P.j && (actoVisual(P.j) === 3 || (actoVisual(P.j) === 5 && P.j.actoBase === 3))) for (const p of polillas) if (p.viva) out.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, r: 8, i: 0.32 });
    // En la hoguera las polillas arden un poco, y las ascuas alumbran.
    if (P && P.j && (formaDe(P.j) === 8)) for (const p of polillas) if (p.viva) out.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, r: 7, i: 0.3 });
    for (const l of lumbres) if (l.viva && !l.quieta) out.push({ x: l.x, y: l.y, r: 15, i: 0.85 });
    if (msj) out.push({ x: msj.x, y: msj.y + 5, r: 14, i: 0.8 });
    if (jefe && !jefe.muerto) {
      if (jefe.tipo === "faro") out.push({ x: jefe.x, y: jefe.y + 1, r: 30, i: 0.9 });
      if (jefe.tipo === "esfinge" && jefe.marcas > 0) for (const [mx, my] of S.MARCAS_ESFINGE) out.push({ x: jefe.x + (mx - 39) * escalaJefe(), y: jefe.y + (my - 22) * escalaJefe(), r: 10, i: jefe.marcas * 0.8 });
      if (jefe.tipo === "esfinge") for (const c of [jefe].concat((jefe.espejos || []).filter(d => d.viva))) out.push({ x: c.x, y: c.y, r: 22 * escalaJefe(), i: (jefe.fase > 1 ? 0.3 : 0.18) * jefe.alfa });   // un contorno: nunca del todo invisible (y sus espejismos, igual)
      if (jefe.tipo === "alba") out.push({ x: jefe.x, y: jefe.y, r: 30 + (1 - jefe.dist / M.DISTANCIA_ALBA) * 80, i: 1 });
      if (jefe.tipo === "nodriza") out.push({ x: jefe.x, y: jefe.y, r: 26, i: 0.35 });
      if (jefe.tipo === "casco" && !jefe.sinLlama) out.push({ x: jefe.x, y: jefe.y + 12, r: 30, i: 0.8 });
      if (jefe.fatuo) out.push({ x: jefe.fatuo.x, y: jefe.fatuo.y, r: 26, i: 0.85 });
      if (jefe.tipo === "crisalida") out.push({ x: jefe.x, y: jefe.y, r: 30, i: 0.5 });
      if (jefe.tipo === "hoguera") out.push({ x: jefe.x, y: jefe.y + 4, r: 70, i: 1 });
      if (jefe.tipo === "luna") out.push({ x: jefe.x, y: jefe.y, r: 44, i: 0.75 * (1 - (jefe.nueva || 0)) });
      if (jefe.tipo === "constelacion") for (const h of jefe.hermanas) if (!h.velada) { const p = posHermana(h); out.push({ x: p.x, y: p.y, r: 14, i: 0.6 }); }
      if (jefe.tipo === "sol") out.push({ x: jefe.x, y: jefe.y, r: 110, i: jefe.oculta ? 0.4 : 1 });
      // Lo que alumbran las habilidades de las fases 2 y 3.
      for (const z of jefe.balizas || []) out.push({ x: z.x, y: z.y, r: 16, i: 0.7 });
      for (const c of jefe.charcos || []) out.push({ x: c.x, y: M.Y_FANAL - 2, r: 22, i: 0.8 });
      if (jefe.tipo === "hoguera") for (const o of jefe.orbita) if (o.viva && o.lanz) { const p = posPreso(o); out.push({ x: p.x, y: p.y, r: 16, i: 0.8 }); }
      if (jefe.red) for (let i = 1; i < 20; i += 3) if (jefe.red.segs[i]) out.push({ x: i * 12 + 6, y: jefe.red.y, r: 12, i: 0.35 });
      if (jefe.tipo === "nodriza") for (const l of larvas) if (l.huevo && l.vida > 0) out.push({ x: l.x, y: l.y, r: 12, i: 0.6 });
      // Y las de la fase 4.
      for (const b of jefe.balasR || []) out.push({ x: b.x, y: b.y, r: 14, i: 0.6 });
      if (jefe.sombra) out.push({ x: jefe.sombra.x, y: jefe.sombra.y, r: 24, i: 0.75 });
      if (jefe.cerco && jefe.cerco.izq > 4) { out.push({ x: jefe.cerco.izq - 12, y: M.Y_FANAL, r: 34, i: 0.8 }); out.push({ x: jefe.cerco.der + 12, y: M.Y_FANAL, r: 34, i: 0.8 }); }
      if (jefe.reclamo) for (const l of larvas) if (l.reclamo && l.vida > 0) out.push({ x: l.x, y: l.y, r: 9, i: 0.5 });
      if (jefe.rayoLuna && jefe.rayoLuna.on) out.push({ x: jefe.rayoLuna.x, y: 220, r: 40, i: 0.8 });
      if (jefe.amanecer) out.push({ x: jefe.amanecer.x, y: jefe.amanecer.y, r: 130, i: 1 });
      for (const y of jefe.yesca || []) if (y.t > 0) out.push({ x: y.n.x + y.n.w / 2, y: y.n.y, r: 26, i: 0.9 });
      if (jefe.aurora) for (const b of jefe.aurora.bandas) out.push({ x: b.x, y: 230, r: 34, i: jefe.aurora.on ? 0.5 : 0.2 });
      // Y las de la fase 6.
      if (jefe.muda) out.push({ x: jefe.muda.x, y: jefe.muda.y, r: 24, i: 0.45 });
      for (const s of jefe.esquirlas || []) if (s.t >= 0) out.push({ x: s.x, y: M.Y_FANAL - 6, r: 12, i: 0.6 });
      for (const b of jefe.botellas || []) out.push({ x: b.x, y: b.y - 3, r: 12, i: 0.6 });
      if (jefe.colada && jefe.colada.on) out.push({ x: jefe.colada.x, y: 230, r: 34, i: 0.9 });
      if (jefe.lupa && jefe.lupa.on) out.push({ x: jefe.lupa.x, y: M.Y_FANAL, r: 30, i: 1 });
      if (jefe.calei && jefe.calei.on) for (let k = 0; k < HACES_CALEI; k++) if (jefe.calei.m & (1 << k)) out.push({ x: xHazCalei(k), y: M.Y_FANAL - 10, r: 22, i: 0.7 });
      // Y las de la fase 7.
      if (jefe.grieta && jefe.grieta.on) for (const sx of [-1, 1]) out.push({ x: jefe.grieta.x + sx * jefe.grieta.d, y: 220, r: 30, i: 0.8 });
      if (jefe.calices) { for (const x of jefe.calices.xs) out.push({ x, y: Y_CALIZ, r: 14, i: 0.5 }); if (jefe.calices.on) for (const sl of jefe.calices.malos || []) out.push({ x: X_CALIZ[sl], y: 270, r: 44, i: 0.9 }); }
      for (const m of jefe.monedas || []) out.push({ x: m.x, y: m.y, r: 8, i: 0.5 });
      if (jefe.aguja && !jefe.aguja.fin) out.push({ x: jefe.aguja.x, y: jefe.aguja.y, r: 14, i: 0.6 });
      for (const c of jefe.charcosOro || []) if (c.t >= 0) out.push({ x: c.x, y: Y_AGUA, r: 10 + c.w, i: 0.8 });
      if (jefe.fulgor && jefe.fulgor.on) out.push({ x: (jefe.fulgor.x0 + jefe.fulgor.x1) / 2, y: 260, r: 60, i: 0.9 });
      if (jefe.deslumbre && !jefe.deslumbre.pum) out.push({ x: W / 2, y: 190, r: 60 + 180 * jefe.deslumbre.q, i: jefe.deslumbre.q });
    }
    for (const c of columnas) if (!c.aviso) out.push({ x: c.x, y: 200, r: 40, i: 0.9 });
    for (const l of luciernagas) out.push({ x: l.x, y: l.y, r: l.libre ? 14 : 10, i: 0.7 });
    return out;
  }

  /* El metrónomo de abajo: las corcheas del compás, los pulsos más
     grandes, y el que suena ahora encendido. Dorado si el último tiro
     salió afinado. */
  function dibujaMetronomo() {
    const c = musica.compasActual(), ancho = Math.min(120, c.largo * 8), x0 = Math.floor(W / 2 - ancho / 2), y = H - 5;
    const paso = ancho / c.largo;
    for (let i = 0; i < c.largo; i++) {
      const esPulso = c.nivel[i] > 0, actual = ((c.tick - 1 + c.largo) % c.largo) === i;
      ex.fillStyle = actual ? (fx.metro > 0 ? "#ffd27a" : "#fff6d8") : esPulso ? "rgba(255,240,220,.55)" : "rgba(255,240,220,.22)";
      const h = esPulso ? (c.nivel[i] === 2 ? 3 : 2) : 1;
      ex.fillRect(Math.floor(x0 + i * paso), y - h + 1, actual ? 2 : 1, h);
    }
    // La resonancia: tantas rayitas como el multiplicador.
    const m = multiplicador();
    for (let i = 1; i < m; i++) { ex.fillStyle = "#ffd27a"; ex.fillRect(x0 + ancho + 4 + (i - 1) * 2, y - 2, 1, 3); }
  }
  /* Los poderes activos, abajo a la izquierda, con lo que les queda. */
  function dibujaPoderesActivos() {
    if (!F) return;
    let x = 4;
    for (const [k, t, max] of [["pabilo", F.pabilo, 12], ["lente", F.lente, 8], ["campana", F.campana > 0 ? 1 : 0, 1]]) {
      if (t <= 0) continue;
      ex.drawImage(banco.poder(k), x, H - 12);
      ex.fillStyle = "#ffd27a"; ex.fillRect(x, H - 4, Math.max(1, Math.round(7 * t / max)), 1);
      x += 10;
    }
  }

  function dibuja() {
    const acto = cielo.hacia || 1;
    ex.globalCompositeOperation = "source-over";
    ex.fillStyle = "#000"; ex.fillRect(0, 0, W, H);
    lx.clearRect(0, 0, W, H);
    // 1. Cielo (fundido entre actos en el tránsito).
    if (cielo.mezcla < 1 && cielo.desde) { dibujaFondo(cielo.desde, 1); dibujaFondo(acto, suave(cielo.mezcla)); }
    else dibujaFondo(acto, 1);
    if (acto === 3 || acto === 5) dibujaSiluetas();
    dibujaEstrellas();
    if (acto === 4) dibujaRayos(1);
    dibujaMotas();
    // 2. El juego.
    for (const n of naufragios) { if (n.sucio) pintaNaufragio(n); ex.drawImage(n.cv, n.x, n.y); }
    dibujaJefe();
    dibujaPolillas();
    dibujaMenores();
    if (estado === "portada") dibujaAdorno();
    dibujaFanal();
    dibujaBalas();
    dibujaEscamas();
    dibujaLleno();
    // 3. La niebla, encima de todo lo que está lejos.
    const j = P && P.j, niebla = (j && j.niebla) || (acto === 2 ? 0.4 : 0);
    if (niebla > 0) {
      const f = fondoDe(2), h = f.niebla.height, y = (cielo.desp * 0.6 + tMusica * 3) % h;
      ex.globalAlpha = niebla * 0.85; ex.drawImage(f.niebla, 0, y - h); ex.drawImage(f.niebla, 0, y); ex.globalAlpha = 1;
    }
    // 4. Luz: oscuridad posterizada y brillos aditivos.
    const luces = reuneLuces();
    let nivel = (j ? M.actoDe(j).oscuro : M.ACTOS[acto] ? M.ACTOS[acto].oscuro * 0.8 : 0.2);
    if (cielo.mezcla < 1 && cielo.desde && M.ACTOS[cielo.desde]) nivel = lerp(M.ACTOS[cielo.desde].oscuro, M.ACTOS[acto] ? M.ACTOS[acto].oscuro : nivel, suave(cielo.mezcla));
    if (jefe && jefe.tipo === "alba") nivel *= jefe.dist / M.DISTANCIA_ALBA;
    if (cielo.lleno > 0) nivel *= 1 - clamp(cielo.lleno / 2, 0, 1) * (1 - clamp((cielo.lleno - 14) / 6, 0, 1));
    if (estado === "portada") nivel *= 0.7;
    if (dibujaOscuridad(nivel, luces)) ex.drawImage(sombra, 0, 0);
    // Los brillos: la llama, los tiros, las escamas, las explosiones.
    lx.globalCompositeOperation = "lighter";
    if (F && (!F.apagado || F.apagado < 1.4)) {
      const r = radioLuz();
      brillo(F.x, M.Y_FANAL - 6, 18 + pulsoLuz * 4, P && P.llamas === 1 ? "#a8c8ff" : "#ffcf6b", 0.8);
      brillo(F.x, M.Y_FANAL - 6, r * 0.7, acto === 2 ? "#b8d0c4" : acto === 3 ? "#6a55a0" : "#ff9a3c", acto === 2 ? 0.22 : 0.12);
    }
    for (const b of balas) brillo(b.x, b.y + 2, b.rayo ? 14 : b.afinado ? 10 : 6, b.rayo ? "#e8f6ff" : b.afinado ? "#ffd27a" : "#ffe6a8", 0.7);
    for (const l of luciernagas) brillo(l.x, l.y, l.libre ? 10 : 7, l.libre ? "#ffd070" : "#fff0b0", l.cd > 0 ? 0.25 : 0.7);
    for (const c of columnas) if (!c.aviso) brillo(c.x, 200, 60, c.sol ? "#ffd070" : "#ff6a20", 0.35);
    for (const e of escamas) brillo(e.x, e.y, e.muro ? 6 : 5, (S.PALETAS[e.estilo] || S.PALETAS[1]).escama[1], 0.55);
    for (const d of destellos) brillo(d.x, d.y, d.r * 0.6, "#fff0c8", 0.8 * (1 - d.t / d.dur));
    for (const l of lumbres) if (l.viva && !l.quieta) brillo(l.x, l.y, 7, "#fff2c8", 0.35);
    for (const p of poderes) brillo(p.x, p.y, 7, "#ffd27a", 0.6);
    if (msj) brillo(msj.x, msj.y + 6, 8, "#fff0c8", 0.7);
    if (jefe && !jefe.muerto) {
      if (jefe.tipo === "faro") brillo(jefe.x, jefe.y + 1, 16, "#e6f6dc", 0.9);
      if (jefe.tipo === "alba") brillo(jefe.x, jefe.y, 24 + (1 - jefe.dist / M.DISTANCIA_ALBA) * 60, "#fff2d8", 0.7);
      if (jefe.tipo === "casco" && !jefe.sinLlama) brillo(jefe.x, jefe.y + 12, 16, jefe.fase >= 3 ? "#a8c8ff" : "#ffb060", 0.8);
      if (jefe.tipo === "hoguera") brillo(jefe.x, jefe.y + 6, 50, "#ff8a3a", 0.6);
      if (jefe.tipo === "crisalida") brillo(jefe.x, jefe.y, 18, "#f0d8e8", 0.35);
      if (jefe.tipo === "luna") brillo(jefe.x, jefe.y, 26, "#dfe8ff", 0.45 * (1 - (jefe.nueva || 0)));
      if (jefe.tipo === "constelacion") for (const h of jefe.hermanas) if (!h.velada) { const p = posHermana(h); brillo(p.x, p.y, 8, "#fff0c8", 0.6); }
      if (jefe.tipo === "sol") brillo(jefe.x, jefe.y, 60 * escalaJefe() * (jefe.colapso || 1), jefe.fase === 4 ? "#a8d8ff" : "#ffd070", jefe.oculta ? 0.2 : 0.55);
      // Las fases 2 y 3 traen su propia luz: brasa la herida, casi blanca la coronada.
      if (jefe.fase > 1 && jefe.tipo !== "constelacion") brillo(jefe.x, jefe.y, 32 * escalaJefe(), jefe.fase >= 7 ? "#ffd070" : jefe.fase >= 6 ? "#ff8cd8" : jefe.fase >= 5 ? "#ffc8a0" : jefe.fase === 4 ? "#8fd8ff" : jefe.fase === 3 ? "#ffe6b0" : "#ff3a2a", jefe.fase >= 3 ? 0.22 : 0.26);
    }
    if (cielo.lleno > 0) brillo(W / 2, H / 2, 260, "#fff6e0", 0.25 * clamp(cielo.lleno / 2, 0, 1) * (1 - clamp((cielo.lleno - 14) / 6, 0, 1)));
    dibujaParticulas();
    lx.globalCompositeOperation = "source-over";
    ex.globalCompositeOperation = "lighter"; ex.globalAlpha = 0.85; ex.drawImage(luz, 0, 0); ex.globalAlpha = 1;
    ex.globalCompositeOperation = "source-over";
    // 5. Lo que siempre se ve: los números que flotan, el metrónomo y los poderes.
    for (const f of flotantes) { ex.globalAlpha = clamp(f.vida / 0.4, 0, 1); const img = banco.cifras(f.texto, f.col); ex.drawImage(img, Math.floor(f.x - img.width / 2), Math.floor(f.y)); }
    ex.globalAlpha = 1;
    if (estado === "juego" || estado === "relato" || estado === "pausa") { dibujaMetronomo(); dibujaPoderesActivos(); }
    componer();
  }

  /* Pasa el lienzo lógico al visible: escala sin suavizar, bloom, sacudida,
     aberración cromática y destello. */
  function componer() {
    const tr = fx.trauma * fx.trauma, sac = tr * 12;
    const ox = Math.round((Math.random() * 2 - 1) * sac), oy = Math.round((Math.random() * 2 - 1) * sac);
    pv.setTransform(1, 0, 0, 1, 0, 0);
    pv.globalCompositeOperation = "source-over"; pv.globalAlpha = 1;
    pv.fillStyle = "#000"; pv.fillRect(0, 0, W * K, H * K);
    pv.imageSmoothingEnabled = false;
    pv.drawImage(escena, ox, oy, W * K, H * K);
    // Bloom: la capa de luz reducida dos veces y agrandada con suavizado.
    ba.clearRect(0, 0, W / 2, H / 2); ba.imageSmoothingEnabled = true; ba.drawImage(luz, 0, 0, W / 2, H / 2);
    bb.clearRect(0, 0, W / 4, H / 4); bb.imageSmoothingEnabled = true; bb.drawImage(bloomA, 0, 0, W / 4, H / 4);
    pv.imageSmoothingEnabled = true; pv.globalCompositeOperation = "lighter";
    pv.globalAlpha = 0.55; pv.drawImage(bloomB, ox, oy, W * K, H * K);
    pv.globalAlpha = 0.3; pv.drawImage(bloomA, ox, oy, W * K, H * K);
    pv.globalAlpha = 1; pv.globalCompositeOperation = "source-over";
    // Aberración cromática: el rojo y el cian se separan un poco en los golpes.
    if (fx.aberr > 0.02 && opciones.aberracion) {
      const k = Math.max(1, Math.round(fx.aberr * 9));
      arx.globalCompositeOperation = "source-over"; arx.drawImage(lienzo, 0, 0); arx.globalCompositeOperation = "multiply"; arx.fillStyle = "#ff0000"; arx.fillRect(0, 0, W * K, H * K);
      acx.globalCompositeOperation = "source-over"; acx.drawImage(lienzo, 0, 0); acx.globalCompositeOperation = "multiply"; acx.fillStyle = "#00ffff"; acx.fillRect(0, 0, W * K, H * K);
      pv.fillStyle = "#000"; pv.fillRect(0, 0, W * K, H * K);
      pv.drawImage(abR, -k, 0); pv.globalCompositeOperation = "lighter"; pv.drawImage(abC, k, 0); pv.globalCompositeOperation = "source-over";
    }
    if (fx.flash > 0.01) { pv.globalAlpha = Math.min(0.9, fx.flash); pv.fillStyle = fx.flashColor; pv.fillRect(0, 0, W * K, H * K); pv.globalAlpha = 1; }
  }

  /* ================================================================
     El bucle
     ================================================================ */
  let ultimo = performance.now();
  function cuadro(ahora) {
    requestAnimationFrame(cuadro);
    let dt = (ahora - ultimo) / 1000;
    ultimo = ahora;
    if (dt > 0.05) dt = 0.05;                                         // tras un tirón, no se salta medio juego
    if (document.hidden) return;
    paso(dt);
  }
  /* Un paso del juego: música, pulsos, mundo y dibujo. */
  /* Modo celular (CLAUDE.md): la travesía ocupa toda la pantalla mientras
     dura; la pausa, el final y la portada devuelven el menú. La franja de
     botones solo se ve mientras se rema (taller y relato se tocan sin ella). */
  const EN_TRAVESIA = new Set(["juego", "relato", "taller", "revelacion", "final", "muriendo"]);
  let inmVisto = null;
  function sincronizaInmersivo() {
    const v = EN_TRAVESIA.has(estado) && !panel;
    if (v !== inmVisto) { inmVisto = v; if (Club && Club.inmersivo) Club.inmersivo(v); }
    html.classList.toggle("sin-franja", estado !== "juego");
  }
  function paso(dt) {
    sincronizaInmersivo();
    if (estado !== "pausa") {
      tMusica += dt;
      musica.avanza(tMusica, dt);
      anotaPulsos();
      for (const p of musica.consumePulsos(tMusica)) alPulso(p);
      actualiza(dt);
    }
    dibuja();
  }

  /* ================================================================
     Arranque
     ================================================================ */
  F = nuevoFanal();
  aplicaOpciones();
  aplicaSonido();
  if (Club) Club.category("club-fanal-jornadas");
  aPortada();
  requestAnimationFrame(cuadro);
  // El récord de la nube, cuando llega, se muestra como récord.
  // Lo que la tabla de jornadas sabe de esta cuenta (también si no tiene fila).
  window.addEventListener("club-tabla", e => {
    const d = e.detail || {};
    if (d.categoria === "club-fanal-jornadas" && cuentaUrl !== "invitado" && cuentaUrl !== "local") filaJornadas = d.propio && Number.isFinite(d.propio.puntos) ? { puntos: d.propio.puntos, tiempo: +d.propio.tiempo || Infinity } : null;
  });
  window.addEventListener("club-record", e => {
    const d = e.detail || {};
    if (d.categoria === "club-fanal-travesia") prog.mejor.travesia = Math.max(prog.mejor.travesia, d.puntos || 0);
    // La tabla que se ve es la de jornadas: su fila también es récord (y
    // evita volver a mandar una jornada que la nube ya tiene).
    if (d.categoria === "club-fanal-jornadas") prog.mejor.jornada = Math.max(prog.mejor.jornada, d.puntos || 0);
    pintaHud(); pintaPortada();
  });

  /* Ganchos para probar desde la consola o un script (como __yemas):
     saltar a una jornada, ver el estado y avanzar el juego sin pantalla.
     Siguen sirviendo para probar, pero tocar cualquiera (también leer el
     mundo, que es lo que necesita un bot) marca la página: desde entonces
     ninguna partida se manda a la clasificación (ver `tocada`). */
  function toca() {
    if (!tocada) console.info("FANAL: se usó __fanal. Desde ahora, ninguna partida de esta página entra en la clasificación.");
    tocada = true;
    if (P) P.tocada = true;
  }
  const marcado = o => new Proxy(o, {
    get(t, k) { toca(); const v = Reflect.get(t, k, t); return typeof v === "function" ? v.bind(t) : v; },
    set(t, k, v) { toca(); t[k] = v; return true; }
  });
  const ganchos = {
    salta(n) { empieza({ j: Math.max(1, n | 0), puntos: 0, llamas: 3, luces: 200, ver: FP.VERSION }); },
    sigue: () => { relatoListo = 0; sigueRelato(); },
    paso: dt => paso(dt || 1 / 60),
    estado: () => ({ estado, brasas: P && P.brasas, jornada: P && P.jornada, puntos: P && P.puntos, llamas: P && P.llamas, luces: P && P.luces, restan: form && form.restan, jefe: jefe && { tipo: jefe.tipo, vida: jefe.vida, max: jefe.max, fase: jefe.fase, grado: jefe.grado, dist: jefe.dist }, notas: P && P.notas }),
    desbloquea() { prog.alba = true; prog.hoguera = true; prog.sol = true; guardaProgreso(false); pintaPortada(); },
    brasas: n => { if (P) { P.brasas += n == null ? 10 : n; pintaHud(true); } },
    prueba: () => (P && P.prueba ? JSON.parse(JSON.stringify(P.prueba)) : null),
    taller: () => (P ? { mej: Object.assign({}, P.mej), brasas: P.brasas, arma: arma(), nave: naveF() } : null),
    // Hace que el jefe lance ya su habilidad de fase (2 a 7), para probarla.
    especial: n => { if (jefe && jefe.fase > 1) { jefe.cdEsp = 0; jefe.cd = 0; jefe.pideEsp = n || 2; } },
    dano: v => { if (jefe) { jefe.vida -= v || 999; pintaVidaJefe(); if (jefe.vida <= 0 && !jefe.muerto) muereJefe(); } },
    limpia: () => { for (const p of polillas) if (p.viva) mata(p, null); for (const l of lumbres) l.viva = false; },
    acerca: () => { if (jefe && jefe.tipo === "alba") jefe.dist = 2; },
    deja: n => { let k = 0; for (const p of polillas) if (p.viva && ++k > (n || 3)) mata(p, null); },
    golpe: () => { F.invul = 0; golpeFanal(); },
    llamas: n => { if (P) { P.llamas = Math.max(1, n | 0); pintaLlamas(); } },
    teclas,
    dispara: () => disparar(),
    stats: () => P && { afinados: P.stats.afinados, disparos: P.stats.disparos, mejorRes: P.stats.mejorRes, danios: P.stats.danios, fuentes: P.fuentes },
    mundo: () => ({ x: F.x, llamas: P && P.llamas, polillas: polillas.filter(p => p.viva).map(p => ({ x: p.x + p.w / 2, y: p.y + p.h, e: p.estado })), escamas: escamas.map(e => ({ x: e.x, y: e.y, vx: e.vx, vy: e.vy })), larvas: larvas.filter(l => l.vida > 0).map(l => ({ x: l.x, y: l.y })), jefe: jefe && { x: jefe.x, y: jefe.y, tipo: jefe.tipo, haz: !!jefe.haz }, estado, pulso: musica.pulsoCercano(tMusica), t: tMusica }),
    musica
  };
  window.__fanal = {};
  for (const [k, v] of Object.entries(ganchos)) window.__fanal[k] = typeof v === "function" ? (...a) => { toca(); return v(...a); } : v;
  window.__fanal.teclas = marcado(teclas);
  window.__fanal.musica = marcado(musica);
  Object.freeze(window.__fanal);
  // Si el club rechaza la partida, se dice también sobre el juego.
  window.addEventListener("club-rechazo", e => { const m = e.detail && e.detail.motivo; if (m) avisa("No entró en la clasificación: " + m); });
})();
