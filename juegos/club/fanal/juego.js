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
     suelta la Mensajera y en dos secuencias que no se pueden saltar: la
     revelación (al apagar el Faro Ciego) y el cruce con el Alba.
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

  const M = window.FanalMotor, R = window.FanalRelato, S = window.FanalSprites, MU = window.FanalMusica;
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

  let prog = M.mezclaProgreso(lee("fanal.progreso", null), null);     // lo leído, el final visto, el punto de control
  function guardaProgreso(subir) {
    guarda("fanal.progreso", prog);
    if (subir !== false && Club && Club.guardarPartida) Club.guardarPartida(JSON.stringify(prog)); // y a la cuenta
  }
  /* Lo de la cuenta se junta con lo de aquí: se suman las cartas, el final
     visto no se olvida y el punto de control más nuevo gana. */
  if (Club && Club.pedirPartida) Club.pedirPartida(dato => {
    let nube = null;
    try { nube = dato && typeof dato.d === "string" ? JSON.parse(dato.d) : null; } catch (e) { nube = null; }
    const junto = M.mezclaProgreso(prog, nube), antes = JSON.stringify(prog);
    prog = junto;
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

  function nuevaPartida(modo) {
    return {
      modo,                       // "travesia" o "sinfin"
      jornada: 1, j: null, acto: 1, completadas: 0,
      puntos: 0, llamas: M.LLAMAS_INICIO, notas: 0, cadena: 0, cadenaT: 0,
      luces: modo === "sinfin" ? 140 : 430, // las luces del cielo (ver apagaEstrella)
      sinDanio: true, disparosJ: 0, aciertosJ: 0, fragJ: [], ecoJ: [],
      mensajerasRest: 0, tMensajera: 0, fuegoAcum: 0, picadaAcum: 0,
      acogidas: 0, apagadasLumbre: 0, albaGolpes: 0, tiempo: 0, reintentos: 0,
      stats: { disparos: 0, aciertos: 0, afinados: 0, apagadas: 0, mejorRes: 1, danios: 0, cartas: 0 },
      terminando: 0, fuentes: {}
    };
  }
  function nuevoFanal() {
    return { x: W / 2, vx: 0, invul: 0, campana: 0, pabilo: 0, lente: 0, cool: 0, remo: 0, apagado: 0, viento: 0, radioExtra: 0, aro: 0 };
  }
  const actoVisual = j => (j ? j.acto : 1);                          // 1..4 historia, 5 sin fin
  const formaDe = j => (j && j.acto === 5 ? j.actoBase : j ? j.acto : 1); // de qué acto son las polillas
  const multiplicador = () => M.resonancia(P ? P.notas : 0);

  /* ================================================================
     Cascos hundidos (los escudos)
     ================================================================ */
  function creaNaufragios(acto) {
    return [48, 96, 144, 192].map(cx => ({ x: cx - 12, y: M.Y_NAUFRAGIOS - 6, w: 24, h: 12, pix: S.naufragio(acto), cv: S.lienzo(24, 12), sucio: true }));
  }
  function pintaNaufragio(n) {
    const c = n.cv.getContext("2d");
    c.clearRect(0, 0, 24, 12);
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
    return { x: form.x + p.dx + Math.sin(form.t * 1.4 + p.fase) * der * 0.4, y: form.y + p.dy + Math.sin(form.t * 2 + p.fase + p.col * 0.4) * der * 0.5 };
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
      if (escamas.filter(e => !e.jefe).length < j.balas) disparaFormacion();
    }
    // Picadas: polillas que dejan la fila y bajan hacia la luz.
    P.picadaAcum += (j.picada || 0) * dt;
    while (P.picadaAcum >= 1) {
      P.picadaAcum -= 1;
      const c = polillas.filter(p => p.viva && p.estado === "fila" && (p.tipo !== "a" || j.acto >= 2));
      if (c.length) { const p = c[Math.floor(Math.random() * c.length)]; p.estado = "picada"; p.t = 0; p.vx = 0; p.vy = -40; p.disparo = j.acto >= 2; }
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
    if (estado === "juego" && Math.abs(p.x + p.w / 2 - F.x) < 8 && Math.abs(p.y + p.h / 2 - (M.Y_FANAL - 3)) < 7) { mata(p, null); golpeFanal("picada"); return; }
    if (p.y > H + 12) { p.estado = "vuelve"; p.t = 0; p.ox = hueco(p).x; p.oy = -16; p.x = p.ox; p.y = p.oy; }
  }
  function nuevaEscama(x, y, vx, vy, extra) {
    return Object.assign({ x, y, vx, vy, t: 0, estilo: actoVisual(P.j) }, extra || {});
  }
  function disparaFormacion() {
    // Por columna, la polilla más baja; a veces la que está sobre el fanal.
    const porCol = {};
    for (const p of polillas) if (p.viva && p.estado === "fila") { const k = p.col; if (!porCol[k] || p.y > porCol[k].y) porCol[k] = p; }
    const cand = Object.values(porCol);
    if (!cand.length) return;
    let p = cand[Math.floor(Math.random() * cand.length)];
    if (Math.random() < P.j.apunta) p = cand.reduce((a, b) => (Math.abs(b.x + b.w / 2 - F.x) < Math.abs(a.x + a.w / 2 - F.x) ? b : a));
    const vel = { 1: 70, 2: 78, 3: 86, 4: 80, 5: 90 }[actoVisual(P.j)] * (P.j.acto === 5 ? 1 + (M.dificultad(P.jornada) - 1) * 0.25 : 1);
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
    const pts = M.PUNTOS_MENSAJERA[Math.floor(Math.random() * M.PUNTOS_MENSAJERA.length)];
    suma(pts, msj.x, msj.y, true);
    chispas(msj.x, msj.y, 22, ["#fff4e0", "#efe6d6", "#fff0c8"], 60, 0.9, "polvo");
    destella(msj.x, msj.y, 34, 1, 0.4);
    musica.sfx.muerte(msj.x, 7, true);
    apagaEstrella();
    let leida = false;
    if (P.modo === "travesia") {
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
    if (!seguro && (poderes.length || Math.random() > 0.045)) return;
    const pesos = { pabilo: 30, lente: 20, campana: 25, aceite: P.llamas < M.LLAMAS_MAX ? 12 : 0, destello: 15 };
    let r = Math.random() * Object.values(pesos).reduce((a, b) => a + b, 0), tipo = "pabilo";
    for (const k of PODERES) { r -= pesos[k]; if (r <= 0) { tipo = k; break; } }
    poderes.push({ x, y, tipo, t: 0 });
  }
  function tomaPoder(p) {
    musica.sfx.poder();
    anillo(F.x, M.Y_FANAL - 2, "#ffd27a", 18);
    const nombres = { pabilo: "Pabilo doble", lente: "Lente", campana: "Campana de vidrio", aceite: "Aceite: una llama", destello: "Destello" };
    avisa(nombres[p.tipo]);
    if (p.tipo === "pabilo") F.pabilo = 12;
    if (p.tipo === "lente") F.lente = 8;
    if (p.tipo === "campana") F.campana = 1;
    if (p.tipo === "aceite") { P.llamas = Math.min(M.LLAMAS_MAX, P.llamas + 1); pintaLlamas(); }
    if (p.tipo === "destello") {
      relampago("#fff6d8", 0.5); sacude(0.25);
      escamas = escamas.filter(e => e.muro);                           // se lleva todas las escamas (no los muros)
      const bajas = polillas.filter(q => q.viva && q.estado !== "entrando");
      const maxY = Math.max(-1, ...bajas.map(q => q.y));
      for (const q of bajas) if (q.y >= maxY - 3) mata(q, null);        // la fila más baja
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
    if (extra) { P.llamas = Math.min(M.LLAMAS_MAX, P.llamas + extra); pintaLlamas(); avisa("Una llama más"); musica.sfx.poder(); }
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
  function mata(p, bala) {
    if (!p.viva) return;
    p.viva = false;
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
    apagaEstrella();
    soltarPoder(p.x + p.w / 2, p.y + p.h / 2, false);
  }
  /* Un golpe al fanal. */
  function golpeFanal(fuente) {
    if (F.invul > 0 || F.apagado || estado !== "juego") return;
    if (F.campana > 0) {                                               // la campana de vidrio aguanta uno
      F.campana = 0; F.invul = 0.9;
      chispas(F.x, M.Y_FANAL - 4, 18, ["#e8dcc4", "#ffffff"], 70, 0.6);
      musica.sfx.roce(F.x); sacude(0.2); avisa("La campana se rompió");
      return;
    }
    P.llamas--; P.notas = 0; P.cadena = 0; P.sinDanio = false; P.stats.danios++;
    P.fuentes[fuente || "?"] = (P.fuentes[fuente || "?"] || 0) + 1;
    if (window.__fanalTraza) window.__fanalTraza.push({ fuente, x: +F.x.toFixed(1), vx: Math.round(F.vx), cerca: escamas.filter(e => Math.abs(e.x - F.x) < 20 && e.y > 250).map(e => [Math.round(e.x), Math.round(e.y), Math.round(e.vx), Math.round(e.vy), e.estilo]) });
    F.invul = 2.2;
    sacude(0.6); fx.aberr = 0.5; relampago("#ff9a3c", 0.32);
    chispas(F.x, M.Y_FANAL - 6, 24, ["#ffcf6b", "#ff9a3c", "#fff6d8"], 80, 0.8);
    musica.sfx.danio();
    escamas = escamas.filter(e => e.muro || Math.hypot(e.x - F.x, e.y - M.Y_FANAL) > 36); // un respiro alrededor
    pintaLlamas();
    if (P.llamas <= 0) apagaFanal();
  }

  /* ================================================================
     Los tiros del fanal
     ================================================================ */
  function disparar() {
    if (estado !== "juego" || F.apagado || F.cool > 0) return;
    const propias = balas.length, max = F.pabilo > 0 ? 4 : 2;
    if (propias >= max) return;
    // ¿Cayó en un pulso? Se compara con lo que se OYE (el audio sale con
    // algo de retraso por la tarjeta de sonido).
    const t = tMusica - musica.latencia, pc = musica.pulsoCercano(t);
    const afinado = M.juzgaPulso(t, pc.previo, pc.siguiente).afinado;
    const vel = F.lente > 0 ? -380 : -300;
    const nueva = dx => balas.push({ x: F.x + dx, y: M.Y_FANAL - 9, vy: vel, afinado, perfora: F.lente > 0 ? 99 : afinado ? 1 : 0, dano: afinado ? 2 : 1, tocados: new Set() });
    if (F.pabilo > 0) { nueva(-3); nueva(3); } else nueva(0);
    F.cool = 0.16;
    P.stats.disparos++; P.disparosJ++;
    if (afinado) { P.stats.afinados++; anillo(F.x, M.Y_FANAL - 9, "#ffd27a", 10); fx.metro = 1; }
    else P.notas = Math.floor(P.notas / 4) * 4;                        // fuera del pulso se pierde lo que iba de la nota
    destella(F.x, M.Y_FANAL - 10, afinado ? 18 : 12, 0.8, 0.1);
    musica.sfx.disparo(F.x, afinado);
  }

  function actualizaBalas(dt) {
    for (let i = balas.length - 1; i >= 0; i--) {
      const b = balas[i];
      b.y += b.vy * dt;
      let fuera = b.y < -6;
      // Contra las escamas: se anulan (los muros de la Esfinge no se rompen).
      for (let k = escamas.length - 1; k >= 0 && !fuera; k--) {
        const e = escamas[k];
        if (!e.muro && !e.devuelta && Math.abs(e.x - b.x) < 3 && Math.abs(e.y - b.y) < 5) {
          escamas.splice(k, 1); chispas(e.x, e.y, 5, ["#ffffff", "#ffd27a"], 30, 0.3);
          if (!b.afinado && b.perfora < 1) fuera = true;
        }
      }
      // La Mensajera.
      if (!fuera && msj && Math.abs(b.x - msj.x) < 9 && Math.abs(b.y - msj.y) < 6) { P.aciertosJ++; P.stats.aciertos++; alcanzaMensajera(); fuera = !b.perfora; }
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
          else { musica.sfx.roce(p.x); chispas(b.x, b.y, 4, ["#ffffff"], 30, 0.25); }
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
    for (const l of larvas) if (l.vida > 0 && Math.abs(b.x - l.x) < 4 && Math.abs(b.y - l.y) < 4) {
      l.vida = 0; P.aciertosJ++; P.stats.aciertos++; subeNota(b.afinado);
      suma(10 * multiplicador(), l.x, l.y); musica.sfx.muerte(l.x, ++P.cadena, false);
      chispas(l.x, l.y, 8, ["#c8a07a", "#fff0c8"], 35, 0.5, "polvo");
      return b.perfora-- <= 0;
    }
    for (const l of lumbres) if (l.viva && Math.abs(b.x - l.x) < 6 && Math.abs(b.y - l.y) < 5) {
      l.viva = false; P.apagadasLumbre++; P.aciertosJ++; P.stats.aciertos++;
      suma(5, l.x, l.y); musica.sfx.muerte(l.x, 0, false);
      chispas(l.x, l.y, 16, ["#fff6e0", "#ffd27a"], 40, 0.9, "polvo");
      return b.perfora-- <= 0;
    }
    for (const s of sombras) if (s.viva && Math.abs(b.x - s.x) < 6 && Math.abs(b.y - s.y) < 5) {
      s.viva = false; P.aciertosJ++; P.stats.aciertos++; subeNota(b.afinado);
      suma(25 * multiplicador(), s.x, s.y); musica.sfx.muerte(s.x, ++P.cadena, false);
      chispas(s.x, s.y, 12, ["#2a1e30", "#6a4a7a"], 40, 0.6, "polvo");
      return b.perfora-- <= 0;
    }
    return false;
  }

  function actualizaEscamas(dt) {
    for (let i = escamas.length - 1; i >= 0; i--) {
      const e = escamas[i];
      e.t += dt;
      e.x += (e.vx + (e.estilo === 1 && !e.muro ? Math.sin(e.t * 18) * 14 : e.estilo === 2 ? Math.sin(e.t * 4) * 6 : 0)) * dt;
      e.y += e.vy * dt;
      let fuera = e.y > H + 4 || e.x < -6 || e.x > W + 6 || e.y < -40;
      if (!fuera) {
        const hit = naufragioEn(e.x, e.y + 2);
        if (hit) { erosiona(hit.n, hit.lx, hit.ly, e.muro ? 3 : 2); fuera = true; }
      }
      if (!fuera && estado === "juego" && Math.abs(e.x - F.x) < 6.5 && e.y > M.Y_FANAL - 8 && e.y < M.Y_FANAL + 5) { golpeFanal(e.devuelta ? "devuelta" : e.muro ? "muro" : "escama"); fuera = true; }
      if (fuera) escamas.splice(i, 1);
    }
  }

  /* ================================================================
     El fanal
     ================================================================ */
  function actualizaFanal(dt) {
    F.invul = Math.max(0, F.invul - dt); F.cool = Math.max(0, F.cool - dt);
    F.pabilo = Math.max(0, F.pabilo - dt); F.lente = Math.max(0, F.lente - dt);
    F.aro = Math.max(0, F.aro - dt);
    if (F.apagado) { F.apagado += dt; return; }
    const puede = estado === "juego" || estado === "relato" || estado === "revelacion";
    let dir = 0;
    if (puede) {
      if (teclas.izq) dir -= 1;
      if (teclas.der) dir += 1;
      if (toque != null && Math.abs(toque - F.x) > 2) dir = Math.sign(toque - F.x) * Math.min(1, Math.abs(toque - F.x) / 14);
    }
    const objetivo = dir * 104;
    F.vx += clamp(objetivo - F.vx, -1100 * dt, 1100 * dt);             // aceleración con algo de inercia: es una barca
    F.vx += F.viento * dt;                                              // el aleteo de la Nodriza empuja
    F.x = clamp(F.x + F.vx * dt, 10, W - 10);
    if (F.x <= 10 || F.x >= W - 10) F.vx = 0;
    F.remo += Math.abs(F.vx) * dt * 0.12 + (estado === "relato" ? dt * 2.4 : 0);
    // Disparo automático mientras se mantiene apretado.
    if (estado === "juego" && (teclas.fuego || toque != null)) {
      autoT -= dt;
      if (autoT <= 0) { disparar(); autoT = 0.3; }
    } else autoT = 0;
  }

  /* El radio de la luz de la llama ahora: el del acto, con las llamas que
     quedan, el latido del pulso, el temblor de la llama y el eclipse. */
  function radioLuz() {
    const base = (P && P.j ? M.actoDe(P.j).radio : M.ACTOS[cielo.hacia] ? M.ACTOS[cielo.hacia].radio : 90);
    const vidas = P ? Math.pow(Math.max(1, P.llamas) / 3, 0.22) : 1;
    const tiembla = 1 + Math.sin(tMusica * 13) * 0.025 + Math.sin(tMusica * 7.3) * 0.03;
    const apagando = F && F.apagado ? Math.max(0, 1 - F.apagado / 1.4) : 1;
    return (base + (F ? F.radioExtra : 0)) * vidas * tiembla * (1 + pulsoLuz * 0.07) * fx.eclipse * apagando;
  }

  /* ================================================================
     Jefes
     ================================================================ */
  function empiezaJefe(j) {
    const tipo = j.jefe;
    jefe = { tipo, vida: M.vidaJefe(j), max: M.vidaJefe(j), x: W / 2, y: -50, t: 0, cd: 2.6, ataque: null, flash: 0, entrando: 2.6, fuerza: j.fuerza || 1, cuadro: 0, muerto: 0, alfa: 1 };
    if (tipo === "faro") { jefe.orbita = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2, r: 28 + (i % 2) * 5, viva: true, f: Math.random() * 6 })); jefe.respawn = 0; }
    if (tipo === "esfinge") { jefe.casaY = 82; jefe.visible = 0.4; }
    if (tipo === "alba") { jefe.dist = M.DISTANCIA_ALBA; jefe.vida = 1; jefe.max = 1; jefe.entrando = 0; jefe.y = 20; jefe.x = W - F.x; jefe.tSombra = 4; }
    const info = R.JEFES[tipo];
    if (tipo !== "alba") {
      $("jefeEpiteto").textContent = info.epiteto; $("jefeTitulo").textContent = info.nombre;
      muestra("capaJefe"); programa(() => oculta("capaJefe"), 2.7);
      $("jefeNombre").textContent = info.nombre; $("jefeBarra").hidden = false; pintaVidaJefe();
    }
    musica.estado({ jefe: tipo, vida: 1, cerca: 0 });
  }
  const faseJefe = () => (jefe.vida / jefe.max > 0.66 ? 0 : jefe.vida / jefe.max > 0.33 ? 1 : 2);
  function pintaVidaJefe() { $("jefeVida").style.width = Math.max(0, (jefe.vida / jefe.max) * 100) + "%"; }

  /* ¿La bala le dio al jefe (o a lo que lo protege)? */
  function golpeaJefe(b) {
    if (!jefe || jefe.muerto || b.tocados.has(jefe)) return false;
    const t = jefe.tipo;
    if (t === "faro") {
      for (const o of jefe.orbita) if (o.viva) {
        const ox = jefe.x + Math.cos(o.a) * o.r, oy = jefe.y + Math.sin(o.a) * o.r * 0.7;
        if (Math.abs(b.x - ox) < 4.5 && Math.abs(b.y - oy) < 4) {
          o.viva = false; P.aciertosJ++; P.stats.aciertos++; subeNota(b.afinado);
          suma(15 * multiplicador(), ox, oy); musica.sfx.muerte(ox, ++P.cadena, false);
          chispas(ox, oy, 8, ["#a9d6a2", "#e6f2d8"], 35, 0.5, "polvo");
          return true;
        }
      }
    }
    if (t === "alba") {
      const esc = escalaAlba(), w = 15 * esc, h = 10 * esc;
      if (Math.abs(b.x - jefe.x) < w / 2 && Math.abs(b.y - jefe.y) < h / 2) {
        // Todo lo que lances, volverá: el tiro empuja al Alba y vuelve hacia ti.
        jefe.dist = Math.min(M.DISTANCIA_ALBA, jefe.dist + M.EMPUJE_ALBA);
        P.albaGolpes++;
        escamas.push(nuevaEscama(jefe.x, jefe.y + h / 2, (F.x - jefe.x) * 0.45, 105, { devuelta: true, estilo: 4 }));
        musica.sfx.empuje(); chispas(b.x, b.y, 10, ["#fff6d8", "#ffd27a"], 40, 0.5);
        return true;
      }
      return false;
    }
    const caja = { nodriza: [20, 14, 0], faro: [11, 11, 2], esfinge: [14, 13, 0] }[t];
    if (jefe.entrando > 0 || (t === "esfinge" && jefe.oculta)) return false;
    if (Math.abs(b.x - jefe.x) < caja[0] && Math.abs(b.y - (jefe.y + caja[2])) < caja[1]) {
      jefe.vida -= b.dano; jefe.flash = 0.07; b.tocados.add(jefe);
      P.aciertosJ++; P.stats.aciertos++; subeNota(b.afinado);
      suma(5 * multiplicador(), null, null);
      musica.sfx.jefeGolpe(); chispas(b.x, b.y, 4, ["#ffffff", "#ffd27a"], 30, 0.3);
      pintaVidaJefe();
      musica.estado({ vida: jefe.vida / jefe.max });
      if (jefe.vida <= 0) muereJefe();
      return true;
    }
    return false;
  }

  function actualizaJefe(dt) {
    if (!jefe) return;
    jefe.t += dt; jefe.flash = Math.max(0, jefe.flash - dt);
    if (jefe.muerto) { jefe.muerto += dt; return; }
    // Con el fanal apagado, el jefe se queda quieto: ya no hay a quién atacar.
    if (estado === "muriendo" || estado === "fin") { jefe.ataque = null; jefe.haz = null; jefe.pista = null; F.viento = 0; return; }
    if (jefe.entrando > 0) {                                           // entra despacio mientras se presenta
      jefe.entrando -= dt;
      const casa = jefe.tipo === "faro" ? 64 : jefe.tipo === "esfinge" ? jefe.casaY : 74;
      jefe.y = lerp(jefe.y, casa, 1 - Math.exp(-dt * 2.2));
      return;
    }
    if (jefe.tipo === "nodriza") nodriza(dt);
    else if (jefe.tipo === "faro") faro(dt);
    else if (jefe.tipo === "esfinge") esfinge(dt);
    else if (jefe.tipo === "alba") alba(dt);
  }
  /* El planificador de ataques: elige uno, lo anuncia y lo deja correr. */
  function planifica(dt, elegir, enfriar) {
    if (jefe.ataque) return;
    jefe.cd -= dt * (jefe.fuerza > 1 ? Math.min(1.6, jefe.fuerza) : 1);
    if (jefe.cd > 0) return;
    jefe.ataque = { nombre: elegir(), t: 0, hecho: 0 };
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
    if (!jefe.ataque || jefe.ataque.nombre !== "aleteo") jefe.x = W / 2 + Math.sin(jefe.t * 0.45) * 66;
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
      if (l.t > 0.6) { l.vx += clamp((F.x - l.x) * 2, -80, 80) * dt; l.vy = Math.min(l.vy + 90 * dt, 80); }
      else l.vy += 20 * dt;
      l.x += (l.vx + Math.sin(l.t * 10 + l.f) * 14) * dt; l.y += l.vy * dt;
      if (estado === "juego" && Math.abs(l.x - F.x) < 6 && Math.abs(l.y - (M.Y_FANAL - 3)) < 6) { l.vida = 0; golpeFanal("larva"); }
      const hit = naufragioEn(l.x, l.y);
      if (hit) { erosiona(hit.n, hit.lx, hit.ly, 2); l.vida = 0; }
      if (l.y > H + 8) l.vida = 0;
    }
  }

  /* El Faro Ciego: un haz que barre (los cascos dan sombra), anillos de
     destellos y un enjambre que lo protege. */
  function faro(dt) {
    const f = faseJefe();
    jefe.x = W / 2 + Math.sin(jefe.t * 0.3) * 20;
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
    if (!a || (a.nombre !== "picada")) { jefe.x = W / 2 + Math.sin(jefe.t * 0.33) * 72; jefe.y = lerp(jefe.y, jefe.casaY + Math.sin(jefe.t * 0.8) * 3, 1 - Math.exp(-dt * 3)); }
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
        if (jefe.y > H + 40) { a.i++; jefe.y = -40; if (a.i < a.n) { a.etapa = "huye"; a.tt = 0.35; } else { a.etapa = "vuelve"; a.tt = 0; jefe.x = W / 2; } }
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
    fx.eclipseObj = 1; F.viento = 0;
    suma(M.PUNTOS_JEFE[jefe.tipo] * (P.j.vuelta ? 1 + 0.25 * P.j.vuelta : 1), jefe.x, jefe.y, true);
    sacude(0.7); relampago("#fff6d8", 0.6); fx.aberr = 0.4;
    chispas(jefe.x, jefe.y, 90, ["#fff6d8", "#ffd27a", S.PALETAS[actoVisual(P.j)].acento], 90, 1.6, "polvo");
    destella(jefe.x, jefe.y, 80, 1, 1.2);
    musica.sfx.muerte(jefe.x, 0, true); musica.sfx.cruce();
    $("jefeBarra").hidden = true;
    musica.estado({ jefe: null });
    apagaEstrella();
    if (jefe.tipo === "faro" && P.modo === "travesia") programa(revelacion, 1.4);
    else if (jefe.tipo === "esfinge" && P.modo === "travesia") { apagaTodas(); programa(terminaJornada, 3.6); }
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
        l.viva = false; P.acogidas++; F.radioExtra += 1.6;
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
    $("jefeBarra").hidden = true; fx.eclipseObj = 1; F.viento = 0;
  }
  function iniciaJornada(n) {
    const j = M.jornada(n);
    P.jornada = n; P.j = j; P.acto = j.acto === 5 ? 5 : j.acto;
    P.sinDanio = true; P.disparosJ = 0; P.aciertosJ = 0; P.fragJ = []; P.ecoJ = []; P.ecoMostrar = null; P.terminando = 0;
    P.fuegoAcum = 0; P.picadaAcum = 0;
    limpiaEntidades();
    naufragios = j.tipo === "lumbre" || j.jefe === "alba" ? [] : creaNaufragios(actoVisual(j));
    if (j.tipo === "oleada") { empiezaOleada(j); P.mensajerasRest = j.mensajeras; P.tMensajera = azar(9, 17); }
    else if (j.tipo === "lumbre") { empiezaLumbres(); P.mensajerasRest = j.mensajeras; P.tMensajera = azar(5, 9); }
    else empiezaJefe(j);
    if (j.tipo === "lumbre") programa(() => musica.estado({ modo: "transito" }), 0.05); // nadie dispara: la música tampoco
    estado = "juego";
    musica.estado({ modo: "juego", jefe: j.tipo === "jefe" ? j.jefe : null, vida: 1, tension: 0, peligro: 0, latido: 1, cerca: 0 });
    cielo.velObj = 4;
    $("hudSup").hidden = false;
    pintaHud(true);
    lienzo.focus({ preventScroll: true });
  }
  function terminaJornada() {
    if (!P || estado === "fin" || estado === "muriendo") return;
    const b = M.bonusJornada({ acto: P.j.acto, sinDanio: P.sinDanio, disparos: P.disparosJ, aciertos: P.aciertosJ });
    if (P.j.tipo !== "lumbre") suma(b.total);
    P.completadas = Math.max(P.completadas, P.jornada);
    if (P.j.tipo === "lumbre") P.piedadJ = P.apagadasLumbre === 0;
    // Las cartas leídas en la jornada quedan en la bitácora para siempre.
    if (P.fragJ.length || P.ecoJ.length) { prog.frag = [...new Set([...prog.frag, ...P.fragJ])].sort((a, c) => a - c); prog.ecos = [...new Set([...prog.ecos, ...P.ecoJ])].sort((a, c) => a - c); guardaProgreso(); }
    transito(P.jornada + 1, P.j.tipo === "lumbre" ? null : b);
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
      if (actoSig === 5 || P.modo === "sinfin") cielo.estrellas = cielo.estrellas.concat(creaEstrellas(30, nSig)).slice(-200);
    } else {
      if (P.modo === "sinfin") musica.ponEtapa(etapaMusical(jSig));
      musica.estado({ modo: "transito", jefe: null });
    }
    // El punto de control: al empezar un acto de la historia.
    if (P.modo === "travesia" && Object.values(M.INICIO_ACTO).includes(nSig) && nSig > 1) {
      prog.punto = { j: nSig, puntos: P.puntos, llamas: P.llamas, luces: P.luces, at: Date.now() };
      guardaProgreso();
    }
    const lineas = [];
    if (cambia) {
      const a = jSig.acto === 5 ? R.ACTO_SINFIN : R.ACTOS[jSig.acto - 1];
      ponActo(jSig.acto === 5 ? "" : "ACTO " + ["I", "II", "III", "IV"][jSig.acto - 1], a.nombre, a.lema);
    } else ponActo("", "", "");
    const caido = P.jornada && P.j && P.j.tipo === "jefe" && R.JEFES[P.j.jefe] ? R.JEFES[P.j.jefe].cae : "";
    if (caido && P.modo === "travesia") lineas.push({ t: caido });
    lineas.push({ t: R.bitacora(nSig), cls: "bitacora" });
    if (jSig.jefe === "alba") lineas.push({ t: R.AVISO_ALBA, cls: "grande" });
    const cartas = P.modo === "travesia" ? P.fragJ.map(i => ({ n: R.romano(i + 1), t: R.FRAGMENTOS[i].texto })) : P.ecoMostrar != null ? [{ n: "~", t: R.ECOS[P.ecoMostrar] }] : [];
    $("capaRelato").classList.add("transito");                         // se ve el cielo pasar mientras se lee
    muestraRelato(lineas, cartas, bonus && bonus.total ? `${bonus.sinDanio ? "SIN DAÑO +" + bonus.sinDanio + " · " : ""}PUNTERÍA +${bonus.precision}` : "", cambia ? 1.4 : 0.4);
    relatoSigue = () => iniciaJornada(nSig);
    relatoAuto = 9 + cartas.length * 4 + (cambia ? 3 : 0);
    pintaHud(true);
  }
  function etapaMusical(j) {
    if (j.acto === 5) return { sinfin: Math.floor((j.n - M.JORNADAS_HISTORIA - 1) / 4) };
    return j.acto;
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
    P.completadas = M.JORNADAS_HISTORIA;
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
    suma(M.PUNTOS_JEFE.alba + (P.albaGolpes === 0 ? 5000 : 0));
    prog.alba = true; if (piedad) prog.piedad = true;
    prog.punto = { j: 0, at: Date.now() };                             // la historia terminó: se borra el punto de control
    guardaProgreso();
    enviaResultados(true);
    relatoSigue = () => { $("capaRelato").classList.remove("suave"); muestraFin(true); };
    estado = "relato"; P.finalViendo = true;
  }

  /* El fanal se apaga. */
  function apagaFanal() {
    estado = "muriendo";
    F.apagado = 0.001;
    musica.sfx.apagado();
    musica.estado({ modo: "apagado", jefe: null });
    chispas(F.x, M.Y_FANAL - 6, 40, ["#3a2a1e", "#6a5a4a", "#9a8a7a"], 30, 2.2, "humo");
    programa(() => { enviaResultados(false); muestraFin(false); }, 2.6);
  }
  /* Manda los puntajes a la clasificación del Club. */
  function enviaResultados(completa) {
    if (!P || P.enviado) return;
    P.enviado = true;
    const tiempo = Math.max(1, Math.round(P.tiempo * 1000));
    const cat = P.modo === "sinfin" ? "club-fanal-sinfin" : "club-fanal-travesia";
    const puntos = Math.round(P.puntos);
    const jornadas = P.modo === "sinfin" ? P.completadas : (completa ? M.JORNADAS_HISTORIA : P.completadas);
    const m = prog.mejor;
    if (Club) {
      if (puntos >= 1) Club.result({ categoria: cat, puntos: Math.min(1000000, puntos), tiempo });
      // La jornada solo se manda cuando mejora: cada resultado cuenta como
      // una partida del club (y paga monedas), y una partida es una sola.
      if (jornadas >= 1 && jornadas > m.jornada) Club.result({ categoria: "club-fanal-jornadas", puntos: jornadas, tiempo });
    }
    // Los récords locales.
    P.nuevoRecord = puntos > (P.modo === "sinfin" ? m.sinfin : m.travesia);
    P.nuevaJornada = jornadas > m.jornada;
    if (P.modo === "sinfin") m.sinfin = Math.max(m.sinfin, puntos); else m.travesia = Math.max(m.travesia, puntos);
    m.jornada = Math.max(m.jornada, jornadas);
    guardaProgreso();
  }

  /* ================================================================
     Empezar, continuar, sin fin
     ================================================================ */
  function empieza(modo, desde) {
    musica.iniciar(); aplicaSonido();
    P = nuevaPartida(modo); F = nuevoFanal(); agenda = [];
    particulas = []; flotantes = []; destellos = [];
    html.classList.remove("ultima-llama");
    if (modo === "travesia" && desde && desde.j > 1) {               // desde el punto de control
      P.puntos = desde.puntos || 0; P.llamas = Math.max(1, desde.llamas || 3); P.luces = desde.luces || 200; P.reintentos = 1;
      P.completadas = desde.j - 1;
    }
    const primera = modo === "sinfin" ? M.JORNADAS_HISTORIA + 1 : desde && desde.j > 1 ? desde.j : 1;
    cielo.estrellas = creaEstrellas(Math.min(P.luces, 430), modo === "sinfin" ? 99 : 7);
    creaMotas();
    if (Club) Club.category(modo === "sinfin" ? "club-fanal-sinfin" : "club-fanal-travesia");
    oculta("capaPortada"); oculta("capaFin");
    if (modo === "travesia" && primera === 1) {                       // la introducción, solo al empezar de cero
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
      P.jornada = primera - 1; P.j = null;
      transito(primera, null);
    }
    pintaHud(true); pintaLlamas();
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
    estado = "portada"; P = null; F = nuevoFanal(); agenda = []; limpiaEntidades();
    for (const id of ["capaFin", "capaPausa", "capaRelato", "capaBitacora", "capaAyuda", "capaOpciones", "capaJefe"]) oculta(id);
    $("hudSup").hidden = true;
    html.classList.remove("ultima-llama");
    cielo.desde = cielo.hacia = 1; cielo.mezcla = 1; html.dataset.acto = 1;
    cielo.estrellas = creaEstrellas(260, 3); creaMotas(); cielo.lleno = 0; cielo.velObj = 4;
    musica.ponEtapa("titulo", true); musica.estado({ modo: "titulo", jefe: null });
    if (Club) Club.category("club-fanal-travesia");
    pintaPortada(); muestra("capaPortada");
    pintaHud(true); pintaLlamas();
  }
  function pintaPortada() {
    const p = prog.punto, c = $("btnContinuar");
    c.hidden = !(p && p.j > 1);
    if (!c.hidden) c.textContent = `Continuar · Acto ${["", "I", "II", "III", "IV"][Object.entries(M.INICIO_ACTO).find(([, j]) => j === p.j)?.[0] || 1]}`;
    const s = $("btnSinFin");
    s.disabled = !prog.alba;
    s.textContent = prog.alba ? "Travesía sin fin" : "Travesía sin fin · se abre en el alba";
    $("btnBitacora").textContent = `Bitácora · ${prog.frag.length}/${R.FRAGMENTOS.length}`;
    const m = prog.mejor;
    $("records").textContent = m.travesia || m.jornada ? `Récord ${m.travesia.toLocaleString("es-CL")} · jornada ${m.jornada}${m.sinfin ? " · sin fin " + m.sinfin.toLocaleString("es-CL") : ""}` : "";
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
    const ve = prog.alba && prog.ecos.length > 0;
    $("ecosTitulo").hidden = !ve; $("listaEcos").hidden = !ve;
    const le = $("listaEcos"); le.replaceChildren();
    if (ve) prog.ecos.forEach(i => { const li = document.createElement("li"); li.textContent = R.ECOS[i]; le.appendChild(li); });
  }
  function muestraFin(completa) {
    estado = "fin";
    oculta("capaRelato");
    const s = P.stats, prec = s.disparos ? Math.round((s.aciertos / s.disparos) * 100) : 0, af = s.disparos ? Math.round((s.afinados / s.disparos) * 100) : 0;
    $("finTitulo").textContent = completa ? "La travesía" : "El fanal se apagó";
    $("finLinea").textContent = completa ? "Cruzaste el alba. La noche sigue, y ahora sabes lo que hay en ella." : R.APAGADO[Math.floor(Math.random() * R.APAGADO.length)];
    const min = Math.floor(P.tiempo / 60), seg = Math.floor(P.tiempo % 60);
    const filas = [
      ["Puntos", Math.round(P.puntos).toLocaleString("es-CL"), P.nuevoRecord],
      ["Jornada", completa && P.modo === "travesia" ? "13 · el alba" : String(P.jornada), P.nuevaJornada],
      ["Polillas apagadas", s.apagadas], ["Precisión", prec + " %"], ["Tiros afinados", af + " %"],
      ["Mejor resonancia", "×" + s.mejorRes], ["Cartas recuperadas", s.cartas], ["Llamas perdidas", s.danios],
      ["Tiempo de travesía", `${min}:${String(seg).padStart(2, "0")}`]
    ];
    if (completa && P.modo === "travesia") filas.push(["Lumbres acogidas", P.acogidas + " de 24"]);
    const dl = $("finStats"); dl.replaceChildren();
    for (const [k, v, nuevo] of filas) { const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v; if (nuevo) dd.className = "nuevo"; dl.append(dt, dd); }
    const p = prog.punto;
    $("btnReencender").hidden = completa || P.modo !== "travesia" || !(p && p.j > 1);
    if (!$("btnReencender").hidden) $("btnReencender").textContent = `Volver a encender · desde la jornada ${p.j}`;
    $("btnFinSinFin").hidden = !prog.alba;
    $("btnFinNueva").textContent = P.modo === "sinfin" ? "Otra travesía sin fin" : "Empezar de nuevo";
    $("btnFinNueva").dataset.accion = P.modo === "sinfin" ? "sinfin" : "nueva";
    if (P.modo === "sinfin") $("btnFinSinFin").hidden = true;
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
    if (a === "nueva") empieza("travesia", null);
    else if (a === "continuar") empieza("travesia", prog.punto);
    else if (a === "reencender") empieza("travesia", prog.punto);
    else if (a === "sinfin") { if (prog.alba) empieza("sinfin", null); }
    else if (a === "bitacora") abrePanel("capaBitacora");
    else if (a === "ayuda") abrePanel("capaAyuda");
    else if (a === "opciones") abrePanel("capaOpciones");
    else if (a === "volver") cierraPanel();
    else if (a === "seguir") sigue();
    else if (a === "abandonar") { if (P) { enviaResultados(false); } aPortada(); }
    else if (a === "portada") aPortada();
  });
  $("capaRelato").addEventListener("pointerdown", () => sigueRelato());
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
    if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      if (panel) cierraPanel(); else if (estado === "pausa") sigue(); else pausa();
      return;
    }
    if (e.code === "KeyM") { alternaSonido(); return; }
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
    menu: () => estado === "portada" || estado === "fin" || estado === "final" || estado === "pausa" || !!panel,
    pistas: [["dpad stickL", "remar"], ["a rt", "disparar al pulso"], ["start", "pausa"], ["y", "sonido"]],
    zonas: [{ sel: ".pie" }]
  });
  // El dedo (o el ratón) sobre el lienzo: rema hasta donde está y dispara al tocar.
  const aLogico = ev => { const r = lienzo.getBoundingClientRect(); return ((ev.clientX - r.left) / r.width) * W; };
  lienzo.addEventListener("pointerdown", ev => {
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
    const rec = P && P.modo === "sinfin" ? prog.mejor.sinfin : prog.mejor.travesia;
    ponTexto("hudRecord", Math.max(rec, P ? Math.round(P.puntos) : 0).toLocaleString("es-CL"));
    ponTexto("hudRes", "×" + multiplicador());
    if (!P) return;
    const j = P.j || M.jornada(Math.max(1, P.jornada));
    const nombre = j.acto === 5 ? "SIN FIN" : R.ACTOS[j.acto - 1].nombre;
    ponTexto("hudJornada", `JORNADA ${Math.max(1, P.jornada)} · ${nombre}`);
    ponTexto("hudLuces", "✦ " + Math.max(0, P.luces));
    let alba;
    if (P.modo === "sinfin") alba = "SIGUIENTE LUZ · " + R.SIGUIENTE_LUZ;
    else if (jefe && jefe.tipo === "alba") alba = cielo.lleno > 0 ? "EL ALBA · CRUZADA" : "AL ALBA · " + Math.ceil(jefe.dist) + (Math.ceil(jefe.dist) === 1 ? " BRAZA" : " BRAZAS");
    else { const q = M.JORNADAS_HISTORIA - Math.max(1, P.jornada) + 1; alba = "AL ALBA · " + q + (q === 1 ? " JORNADA" : " JORNADAS"); }
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
      if (P.mensajerasRest > 0 && !msj && !(form && form.entrando && P.j.tipo === "oleada")) { P.tMensajera -= dtj; if (P.tMensajera <= 0) { lanzaMensajera(); P.mensajerasRest--; P.tMensajera = azar(15, 24); } }
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
      m.y += (acto === 4 ? -10 : acto === 3 ? 9 : 6) * m.z * dt + cielo.vel * m.z * 0.5 * dt;
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
      ex.globalAlpha = acto === 4 ? 0.7 : acto === 3 ? 0.5 : 0.35;
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
    const t = jefe.tipo, blanco = jefe.flash > 0;
    if (t === "nodriza") {
      const img = banco.nodriza(jefe.cuadro, blanco);
      ex.globalAlpha = jefe.muerto ? Math.max(0, 1 - jefe.muerto / 1.2) : 1;
      ex.drawImage(img, Math.floor(jefe.x - img.width / 2), Math.floor(jefe.y - img.height / 2));
      ex.globalAlpha = 1;
      const a = jefe.ataque;
      if (a && a.t < 0.6 && a.nombre === "abanico") { brillo(jefe.x - 16, jefe.y + 2, 14, "#ffd27a", a.t * 1.4); brillo(jefe.x + 16, jefe.y + 2, 14, "#ffd27a", a.t * 1.4); }
      if (a && a.nombre === "puesta" && a.t < 0.5) brillo(jefe.x, jefe.y - 14, 12, "#fff0c8", a.t * 2);
      if (a && a.nombre === "aleteo" && a.t < 0.8) { lx.fillStyle = "#e8d8c0"; for (let i = 0; i < 6; i++) { lx.globalAlpha = 0.4 * (a.t / 0.8); const y = 160 + i * 24 + Math.sin(tMusica * 6 + i) * 4, x0 = a.dir > 0 ? 4 : W - 34; lx.fillRect(x0 + ((tMusica * 60 * a.dir) % 20), y, 22, 1); } lx.globalAlpha = 1; }
    } else if (t === "faro") {
      const img = banco.faro(blanco);
      ex.globalAlpha = jefe.muerto ? Math.max(0.15, 1 - jefe.muerto / 1.6) : 1;
      ex.drawImage(img, Math.floor(jefe.x - img.width / 2), Math.floor(jefe.y - img.height / 2 - 1));
      ex.globalAlpha = 1;
      for (const o of jefe.orbita || []) if (o.viva) {
        const ox = jefe.x + Math.cos(o.a) * o.r, oy = jefe.y + Math.sin(o.a) * o.r * 0.7;
        ex.drawImage(banco.mini(2, (Math.floor(tMusica * 8 + o.f)) & 1), Math.floor(ox - 3), Math.floor(oy - 2));
      }
      dibujaHaz();
    } else if (t === "esfinge") {
      const img = banco.esfinge(jefe.cuadro, blanco);
      ex.globalAlpha = (jefe.muerto ? Math.max(0, 1 - jefe.muerto / 1.4) : 1) * jefe.alfa;
      ex.drawImage(img, Math.floor(jefe.x - img.width / 2), Math.floor(jefe.y - img.height / 2));
      ex.globalAlpha = 1;
      // Las marcas de hueso se encienden antes de atacar.
      const m = jefe.marcas || 0;
      if (m > 0 && !jefe.muerto) for (const [mx, my] of S.MARCAS_ESFINGE) brillo(jefe.x - 39 + mx, jefe.y - 22 + my, 7, "#e8dcc8", m * 0.9);
      if (jefe.ataque && jefe.ataque.nombre === "picada" && jefe.ataque.etapa === "marca") { lx.fillStyle = "#c7a6ff"; lx.globalAlpha = 0.18; lx.fillRect(Math.floor(jefe.x) - 1, 40, 2, H); lx.globalAlpha = 1; }
      if (jefe.pista != null) { brillo(jefe.pista, 34, 10, "#e8dcc8", 0.9); ex.fillStyle = "#e8dcc8"; ex.fillRect(jefe.pista - 3, 30, 7, 1); ex.fillRect(jefe.pista - 2, 31, 5, 1); ex.fillRect(jefe.pista - 1, 32, 3, 1); }
    } else if (t === "alba") {
      const esc = escalaAlba(), img = banco.fanal(true);
      const w = img.width * esc, h = img.height * esc;
      ex.drawImage(img, Math.floor(jefe.x - w / 2), Math.floor(jefe.y - h / 2), w, h);
      // Su llama, del revés: cuelga debajo del vidrio.
      const fy = jefe.y + (h / 2) - 4.5 * esc, fxp = Math.floor(jefe.x);
      ex.fillStyle = "#fffaf0"; ex.fillRect(fxp - Math.floor(esc / 2), Math.floor(fy), esc, 2 * esc);
    }
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
      ex.drawImage(banco.fanal(false, F.invul > 1.9), x - 7, y - 5);
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
    }
  }
  function dibujaEscamas() {
    for (const e of escamas) {
      const x = Math.floor(e.x), y = Math.floor(e.y);
      const pal = S.PALETAS[e.estilo] || S.PALETAS[1];
      if (e.devuelta) { ex.fillStyle = "#fff6d8"; ex.fillRect(x - 1, y - 1, 3, 3); ex.fillStyle = "#ffd27a"; ex.fillRect(x, y - 3, 1, 2); continue; }
      if (e.muro) { ex.fillStyle = pal.escama[1]; ex.fillRect(x - 2, y - 1, 5, 3); ex.fillStyle = pal.escama[0]; ex.fillRect(x - 1, y, 3, 1); continue; }
      ex.fillStyle = pal.escama[0];
      if (e.estilo === 1) { ex.fillRect(x, y - 2, 1, 1); ex.fillRect(x + ((Math.floor(e.t * 18) & 1) ? 1 : -1), y - 1, 1, 1); ex.fillRect(x, y, 1, 1); ex.fillRect(x + ((Math.floor(e.t * 18) & 1) ? -1 : 1), y + 1, 1, 1); }
      else if (e.estilo === 2) { ex.fillRect(x, y - 2, 1, 2); ex.fillRect(x - 1, y, 3, 2); }
      else { ex.fillRect(x, y, 2, 2); ex.fillStyle = pal.escama[1]; ex.fillRect(x - 2, y - 2, 1, 1); ex.fillRect(x + 3, y - 1, 1, 1); }
    }
  }
  function dibujaBalas() {
    for (const b of balas) {
      const x = Math.floor(b.x), y = Math.floor(b.y);
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
    for (const l of larvas) if (l.vida > 0) ex.drawImage(banco.mini(1, Math.floor(l.t * 10) & 1), Math.floor(l.x - 3), Math.floor(l.y - 2));
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
    for (const l of lumbres) if (l.viva && !l.quieta) out.push({ x: l.x, y: l.y, r: 15, i: 0.85 });
    if (msj) out.push({ x: msj.x, y: msj.y + 5, r: 14, i: 0.8 });
    if (jefe && !jefe.muerto) {
      if (jefe.tipo === "faro") out.push({ x: jefe.x, y: jefe.y + 1, r: 30, i: 0.9 });
      if (jefe.tipo === "esfinge" && jefe.marcas > 0) for (const [mx, my] of S.MARCAS_ESFINGE) out.push({ x: jefe.x - 39 + mx, y: jefe.y - 22 + my, r: 10, i: jefe.marcas * 0.8 });
      if (jefe.tipo === "esfinge") out.push({ x: jefe.x, y: jefe.y, r: 22, i: 0.18 * jefe.alfa });   // un contorno: nunca del todo invisible
      if (jefe.tipo === "alba") out.push({ x: jefe.x, y: jefe.y, r: 30 + (1 - jefe.dist / M.DISTANCIA_ALBA) * 80, i: 1 });
      if (jefe.tipo === "nodriza") out.push({ x: jefe.x, y: jefe.y, r: 26, i: 0.35 });
    }
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
    for (const b of balas) brillo(b.x, b.y + 2, b.afinado ? 10 : 6, b.afinado ? "#ffd27a" : "#ffe6a8", 0.7);
    for (const e of escamas) brillo(e.x, e.y, e.muro ? 6 : 5, (S.PALETAS[e.estilo] || S.PALETAS[1]).escama[1], 0.55);
    for (const d of destellos) brillo(d.x, d.y, d.r * 0.6, "#fff0c8", 0.8 * (1 - d.t / d.dur));
    for (const l of lumbres) if (l.viva && !l.quieta) brillo(l.x, l.y, 7, "#fff2c8", 0.35);
    for (const p of poderes) brillo(p.x, p.y, 7, "#ffd27a", 0.6);
    if (msj) brillo(msj.x, msj.y + 6, 8, "#fff0c8", 0.7);
    if (jefe && !jefe.muerto) {
      if (jefe.tipo === "faro") brillo(jefe.x, jefe.y + 1, 16, "#e6f6dc", 0.9);
      if (jefe.tipo === "alba") brillo(jefe.x, jefe.y, 24 + (1 - jefe.dist / M.DISTANCIA_ALBA) * 60, "#fff2d8", 0.7);
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
  function paso(dt) {
    if (estado !== "pausa") {
      tMusica += dt;
      musica.avanza(tMusica, dt);
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
  if (Club) Club.category("club-fanal-travesia");
  aPortada();
  requestAnimationFrame(cuadro);
  // El récord de la nube, cuando llega, se muestra como récord.
  window.addEventListener("club-record", e => {
    const d = e.detail || {};
    if (d.categoria === "club-fanal-travesia") prog.mejor.travesia = Math.max(prog.mejor.travesia, d.puntos || 0);
    if (d.categoria === "club-fanal-sinfin") prog.mejor.sinfin = Math.max(prog.mejor.sinfin, d.puntos || 0);
    pintaHud(); pintaPortada();
  });

  /* Ganchos para probar desde la consola o un script (como __yemas):
     saltar a una jornada, ver el estado y avanzar el juego sin pantalla. */
  window.__fanal = {
    salta(n, modo) { empieza(modo || (n > M.JORNADAS_HISTORIA ? "sinfin" : "travesia"), { j: n, puntos: 0, llamas: 3, luces: 200 }); },
    sigue: () => { relatoListo = 0; sigueRelato(); },
    paso: dt => paso(dt || 1 / 60),
    estado: () => ({ estado, jornada: P && P.jornada, puntos: P && P.puntos, llamas: P && P.llamas, luces: P && P.luces, restan: form && form.restan, jefe: jefe && { tipo: jefe.tipo, vida: jefe.vida, dist: jefe.dist }, notas: P && P.notas }),
    desbloquea() { prog.alba = true; guardaProgreso(false); pintaPortada(); },
    dano: v => { if (jefe) { jefe.vida -= v || 999; pintaVidaJefe(); if (jefe.vida <= 0 && !jefe.muerto) muereJefe(); } },
    limpia: () => { for (const p of polillas) if (p.viva) mata(p, null); for (const l of lumbres) l.viva = false; },
    acerca: () => { if (jefe && jefe.tipo === "alba") jefe.dist = 2; },
    deja: n => { let k = 0; for (const p of polillas) if (p.viva && ++k > (n || 3)) mata(p, null); },
    golpe: () => { F.invul = 0; golpeFanal(); },
    teclas,
    dispara: () => disparar(),
    stats: () => P && { afinados: P.stats.afinados, disparos: P.stats.disparos, mejorRes: P.stats.mejorRes, danios: P.stats.danios, fuentes: P.fuentes },
    mundo: () => ({ x: F.x, llamas: P && P.llamas, polillas: polillas.filter(p => p.viva).map(p => ({ x: p.x + p.w / 2, y: p.y + p.h, e: p.estado })), escamas: escamas.map(e => ({ x: e.x, y: e.y, vx: e.vx, vy: e.vy })), larvas: larvas.filter(l => l.vida > 0).map(l => ({ x: l.x, y: l.y })), jefe: jefe && { x: jefe.x, y: jefe.y, tipo: jefe.tipo, haz: !!jefe.haz }, estado, pulso: musica.pulsoCercano(tMusica), t: tMusica }),
    musica
  };
})();
