/* Metro Rush — City en la carrera (lo que juego.js hace distinto en City).

   QUÉ HACE
   City (city.js, el motor; mundo-city.js, el dibujo) trae cosas que la
   Línea 3 no tiene, y este módulo es lo que las juega:
     · PISAR: caer encima de un cajón o de un dron lo rompe (en vez de
       chocar), da un rebote y monedas; cayendo de golpe (rodar en el aire)
       da el doble;
     · LONAS (y el vapor de Bajo Vías): pisarla te lanza por encima de los
       techos de los trenes;
     · BARANDAS: subido al riel te deslizas, y cada 2 m es una moneda;
     · el CHICLE: un poder de City, una burbuja que revienta en lugar de que
       choques (como la patineta, pero sale en la pista);
     · los PERSONAJES de City, cada uno con su ventaja chica, que se compran
       y se ponen en la tienda solo con un modo de City elegido;
     · las POSTALES (los boletos de City), guardadas aparte de los boletos de
       la Línea 3, y su Libreta.

   POR QUÉ ASÍ
   - Un módulo propio y unas pocas líneas «CITY:» en juego.js: así el resto
     del juego (y quien lo edite en paralelo) casi no se entera de City.
   - Nada de esto toca los METROS ni los PUNTOS: los puntos salen de los
     metros y del multiplicador, y aquí solo cambian la altura (lona, salto
     de Nico), las monedas (que no van a la clasificación) y si un choque se
     perdona (el chicle, igual que la patineta). Por eso la prueba del
     antitrampas (prueba.js) no necesita saber nada nuevo: lo único de City
     que cambia el puntaje son las estrellas secretas, y esas son estrellas
     normales para la prueba (salen del generador con la misma semilla).
   - El chicle NO va en `c.poderes`: el marcador recorre esa lista y le pide
     a M.duracionPoder lo que dura cada uno, y el chicle no es una mejora de
     la tienda. Vive en `c.ciudad.chicle`. */

/** Arma lo de City para el juego. `M` es el motor, `sonido` el de audio.js y
    `aviso(texto)` el cartelito de juego.js. Si city.js no se cargó (M.CITY
    falta), todo responde «no es City» y el juego sigue como siempre. */
export function crearCiudad({ M, sonido, aviso }) {
  const CITY = M.CITY || null;                                   // lo de City en el motor (city.js)
  const PREFIJO = 'city:';                                       // las claves de los personajes de City en la tienda: «city:lia»

  /** ¿El modo `modo` (un objeto de M.MODOS) es de City? */
  const esCity = modo => !!CITY && !!modo && modo.mundo === 'city';
  /** El personaje de City que lleva puesto (su id), o null si va con su aspecto de siempre. */
  const personaje = progreso => {
    const id = progreso.personajeCity;
    return id && CITY && CITY.PERSONAJES[id] && progreso.personajesCity.includes(id) ? id : null;
  };

  /* ---------- los sonidos de City ----------
     Con las mismas dos piezas que los demás efectos (una nota de chip y un
     golpe de ruido, audio.js): así suenan de la misma consola. */
  const son = {
    lona() { sonido.nota(196, 0.32, 0.1, 'tri', { f1: 784 }); sonido.soplo(0.1, 0.06, 1.4); },       // ¡boing!: un tono que sube
    pisa(dron) {                                                 // el crujido de la madera o el chispazo del dron
      if (dron) { sonido.nota(1400, 0.1, 0.06, 'p12', { f1: 300 }); sonido.soplo(0.16, 0.1, 2.4, { corto: true }); }
      else { sonido.soplo(0.14, 0.12, 0.9, { corto: true }); sonido.nota(140, 0.12, 0.08, 'tri', { f1: 70 }); }
    },
    grind() { sonido.soplo(0.06, 0.025, 3.4, { corto: true }); },   // el roce del metal (un chispazo cortito, varias veces por segundo)
    chicle() { sonido.nota(523, 0.12, 0.07, 'p25', { f1: 880 }); },   // tomar el chicle
    revienta() { sonido.soplo(0.09, 0.12, 2.8, { corto: true }); sonido.nota(900, 0.08, 0.07, 'p12', { f1: 200 }); }   // ¡plop!
  };

  /** Lo que dice el resumen según con qué chocaste (se suma a MOTIVOS de juego.js). */
  const MOTIVOS = { cajon: 'Chocaste con unos cajones', dron: 'Te diste con un dron', baranda: 'Chocaste con una baranda' };

  return {
    MOTIVOS,
    esCity,

    /* ---------- la carrera ---------- */

    /** Al empezar una carrera: la curva de velocidad del modo va al mundo
        (la sensación de velocidad, el FOV) y al sonido (el tempo), y en City
        se arma `c.ciudad`. Fuera de City, `c.ciudad` es null. */
    inicia(c, progreso, mundo) {
      const V = c.curva && c.curva.VELOCIDAD;                    // {V0, VMAX, ACEL} del modo (City tiene la suya)
      if (mundo && mundo.curva) mundo.curva(V);
      if (sonido.curva) sonido.curva(V);
      if (mundo && mundo.city) mundo.city.chicle(false);         // sin burbuja de la carrera anterior
      c.ciudad = esCity(c.modo) ? {
        ventaja: CITY.ventajaDe(personaje(progreso)),            // la del personaje puesto: {iman, salto, pisoton, grind, lona}
        chicle: 0,                                               // segundos que le quedan a la burbuja
        yAntes: 0,                                               // la altura de los pies al empezar el cuadro (para pisar)
        grind: 0, grindSon: 0,                                   // metros deslizados desde la última moneda, y el reloj del roce
        pisadas: 0, lonas: 0                                     // cuántos cajones/drones rompió y cuántas lonas usó
      } : null;
    },
    /** Cuánto más alto salta (Nico: ×1,12). Solo cambia la altura. */
    salto: c => (c.ciudad && c.ciudad.ventaja.salto) || 1,
    /** Segundos de más que dura un poder (Lía: +3 s de imán). */
    extraPoder: (c, clase) => (c.ciudad && clase === 'iman' && c.ciudad.ventaja.iman) || 0,
    /** Al empezar la física del cuadro: dónde estaban los pies. */
    antes(c) { if (c.ciudad) c.ciudad.yAntes = c.r.y; },

    /** Después de mover al corredor (fisica en juego.js): las lonas, el
        deslizarse por la baranda y lo que le queda a la burbuja. `sop` es lo
        que M.soporte dijo que había bajo los pies, `t` el reloj del dibujo. */
    fisica(c, sop, dt, mundo, t) {
      const C = c.ciudad, r = c.r;
      if (!C) return;
      // 1) la lona: pisarla (desde el suelo) te lanza a 5,2 m, por encima de los techos
      if (r.y < 0.35 && c.poderes.mochila <= 0) for (const o of c.activos) {
        if (!CITY.enLona(o, r.x, c.D, r.y)) continue;
        o.usada = true; o.usadaT = t;                            // una vez cada una; usadaT hace que se hunda en el dibujo
        r.vy = CITY.impulsoLona(C.ventaja.lona || 1); r.enAire = true;
        r.rodar = 0; r.saltoBufer = -1; r.ultSuelo = -1; r.rodarPend = false;
        c.cuenta.saltos++; C.lonas++;
        son.lona();
        if (mundo) mundo.chispa(r.x, r.y + 0.3, 0, o.variante === 'vapor' ? 0xffe0b0 : 0x6ad1ff);
        break;
      }
      // 2) la baranda: subido al riel (es lo que te sostiene y no vas en el aire) te deslizas
      const riel = sop && sop.apoyo && sop.apoyo.tipo === 'baranda' && !r.enAire;
      if (riel) {
        C.grind += c.V * dt;
        while (C.grind >= 2) {                                   // una moneda cada 2 m (Bruno: dos)
          C.grind -= 2;
          const n = C.ventaja.grind || 1;
          c.monedas += n; c.cuenta.monedas += n;
        }
        C.grindSon -= dt;
        if (C.grindSon <= 0) {                                   // el roce y las chispas, ~8 veces por segundo
          C.grindSon = 0.12; son.grind();
          if (mundo) mundo.chispa(r.x, r.y + 0.05, 0, 0xffd27a);
        }
      } else C.grind = 0;
      // 3) la burbuja de chicle se gasta
      if (C.chicle > 0) {
        C.chicle = Math.max(0, C.chicle - dt);
        if (C.chicle === 0 && mundo && mundo.city) mundo.city.chicle(false);
      }
    },

    /** Un choque con `o` que en realidad es una PISADA: si cayendo encima de
        un cajón o de un dron, lo rompe, rebota y da monedas (5 el cajón, 8 el
        dron; el doble si venías cayendo de golpe; Ámbar, el doble otra vez).
        Devuelve true si lo pisó (y entonces no hay choque). El objeto se
        marca roto (ya no choca: su caja es null) y su dibujo se suelta;
        `o.vis = {roto: true}` evita que el bucle de la pista lo vuelva a
        dibujar, y quitarlo de `c.activos` aquí rompería el recorrido de
        choques, que va por esa misma lista. */
    pisa(c, o, mundo) {
      const C = c.ciudad, r = c.r;
      if (!C || !CITY.pisa(o, C.yAntes, r.vy)) return false;
      o.roto = true;
      if (mundo) { if (mundo.city) mundo.city.rompe(o); mundo.suelta(o); }
      o.vis = { roto: true };
      const golpe = r.rodarPend ? 2 : 1;                          // venía cayendo de golpe (rodó en el aire)
      const n = (o.tipo === 'dron' ? 8 : 5) * golpe * (C.ventaja.pisoton || 1);
      c.monedas += n; c.cuenta.monedas += n; C.pisadas++;
      r.vy = M.impulso(1.1); r.enAire = true; r.rodarPend = false;   // el rebote
      son.pisa(o.tipo === 'dron');
      if (mundo) mundo.chispa(r.x, r.y + 0.3, 0, 0xffe066);
      aviso(`¡Pisotón! +${n} monedas`);
      return true;
    },
    /** Un choque de frente con la burbuja puesta: revienta y te salva (como
        la patineta: 2 s sin chocar). Devuelve true si te salvó. */
    salva(c, mundo) {
      const C = c.ciudad;
      if (!C || C.chicle <= 0) return false;
      C.chicle = 0; c.invulnerable = 2;
      if (mundo && mundo.city) mundo.city.chicle(false, true);   // el reventón
      son.revienta();
      aviso('¡La burbuja de chicle te salvó!');
      return true;
    },
    /** Al caer (muere en juego.js): la burbuja se va. */
    cae(c, mundo) { if (c.ciudad) { c.ciudad.chicle = 0; if (mundo && mundo.city) mundo.city.chicle(false); } },
    /** Un poder recogido: si es el chicle, lo maneja City (y devuelve true). */
    poder(c, clase, mundo) {
      if (!c.ciudad || clase !== 'chicle') return false;
      c.ciudad.chicle = 20; c.cuenta.poderes++;                  // dura 20 s o hasta que revienta
      if (mundo && mundo.city) mundo.city.chicle(true);
      son.chicle(); aviso('¡Chicle! Una burbuja te salva de un choque');
      return true;
    },

    /* ---------- las postales (los boletos de City) ---------- */

    /** ¿Hay que pedir la postal `n` en esta carrera? (es de City y aún no la tiene) */
    faltaPostal: (c, progreso, n) => !!(n && c.ciudad && CITY.POSTALES[n] && !progreso.boletosCity.includes(n)),
    /** Se recogió la postal `n`: va a `progreso.boletosCity` (no a los boletos de la Línea 3). Devuelve su título. */
    postal(progreso, n) {
      if (!progreso.boletosCity.includes(n)) { progreso.boletosCity.push(n); progreso.boletosCity.sort((a, b) => a - b); }
      const P = CITY.POSTALES[n];
      return P ? P.titulo : 'Postal';
    },
    /** El globito de la Libreta en la portada: «2/5» en City, null fuera. */
    cuentaPostales: (modo, progreso) => esCity(modo) ? `${progreso.boletosCity.length}/${CITY.DISTRITOS.length}` : null,
    /** La introducción del mundo del modo (la de City, o null fuera). */
    intro: modo => esCity(modo) ? CITY.INTRO : null,
    /** Llena la Libreta con la historia de City (si el modo es de City) y devuelve true; si no, false. */
    libreta(modo, progreso, $, fmt) {
      if (!esCity(modo)) return false;
      $('libretaIntro').textContent = CITY.INTRO;
      $('listaBoletos').innerHTML = CITY.DISTRITOS.map(e => {
        const b = CITY.POSTALES[e.boleto], tiene = progreso.boletosCity.includes(e.boleto);
        return tiene ? `<li><strong>${b.titulo}</strong><p>${b.texto}</p></li>`
          : `<li class="falta"><strong>Postal n.º ${e.boleto} · ${e.desde ? `desde los ${fmt(e.desde)} m` : e.nombre}</strong><p>Todavía no la encuentras. Está en ${e.nombre}.</p></li>`;
      }).join('');
      $('libretaCuenta').textContent = `${progreso.boletosCity.length} de ${CITY.DISTRITOS.length} postales`;
      return true;
    },

    /* ---------- los personajes en la tienda ----------
       En la tienda, con un modo de City elegido, los personajes de City van
       primero (con la insignia «City») y después los aspectos de siempre.
       Sus claves son «city:<id>» para no chocar con las de M.ASPECTOS. En
       City el corredor lleva el personaje de City puesto (si hay uno); si
       uno se pone un aspecto de siempre estando en City, se saca el de City. */

    /** Las claves de la tienda, en orden. */
    idsTienda: modo => esCity(modo) ? [...Object.keys(CITY.PERSONAJES).map(k => PREFIJO + k), ...Object.keys(M.ASPECTOS)] : Object.keys(M.ASPECTOS),
    /** El aspecto (lo que dibuja mundo.js) de la clave `k`, o undefined. Los de City llevan `city: true`. */
    aspecto(k) {
      if (typeof k === 'string' && k.startsWith(PREFIJO)) {
        const P = CITY && CITY.PERSONAJES[k.slice(PREFIJO.length)];
        return P ? Object.assign({ nombre: P.nombre, precio: P.precio, texto: P.texto, city: true }, P.apariencia) : undefined;
      }
      return M.ASPECTOS[k];
    },
    /** ¿Es suyo? */
    tiene: (progreso, k) => k.startsWith(PREFIJO) ? progreso.personajesCity.includes(k.slice(PREFIJO.length)) : progreso.aspectos.includes(k),
    /** La clave que lleva puesta con el modo `modo`: su personaje de City (en City) o su aspecto de siempre. */
    puestoDe: (progreso, modo) => { const id = esCity(modo) && personaje(progreso); return id ? PREFIJO + id : progreso.aspecto; },
    /** Un botón de la tienda (comprar o ponerse). Devuelve la clave a mostrar
        si lo resolvió City; false si lo resuelve juego.js como siempre (un
        aspecto de siempre: antes, estando en City, se saca el de City). */
    clic(b, progreso, modo) {
      const k = b.dataset.aspecto || b.dataset.poner;
      if (!k || !esCity(modo)) return false;
      if (!k.startsWith(PREFIJO)) { progreso.personajeCity = null; return false; }   // uno de siempre: lo pone juego.js
      const id = k.slice(PREFIJO.length), P = CITY.PERSONAJES[id];
      if (!P) return false;
      if (b.dataset.aspecto) {                                   // comprar (y ponérselo)
        if (progreso.personajesCity.includes(id) || progreso.monedas < P.precio) return false;
        progreso.monedas -= P.precio; progreso.personajesCity.push(id);
        sonido.poder();
      } else sonido.reto();
      progreso.personajeCity = id;
      return k;
    }
  };
}
