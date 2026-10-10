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
       choques (como la patineta, pero sale en la pista). Mientras dura, el
       salto sube más, «rodar» en el aire es un PISOTÓN (bajas de golpe) y al
       caer de él la burbuja rebota y te lanza alto (el ciclo del Bubble Gum
       de City); volando, el chicle atrae las monedas como el imán;
     · los PERSONAJES de City, cada uno con su ventaja chica, que se compran
       y se ponen en la tienda solo con un modo de City elegido;
     · las POSTALES (los boletos de City), guardadas aparte de los boletos de
       la Línea 3, y su Libreta;
     · lo que trae Subway Surfers City (ver city.js): la ENERGÍA de la tabla
       (celdas y la batería; llena, la tabla se enciende gratis), las MONEDAS
       ×2, el pisotón con rebote del chicle, el dron que te lanza, las REJILLAS que abre
       el pisotón y las BURBUJAS de baja gravedad con su doble salto.

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
    vapor() { sonido.soplo(0.55, 0.16, 0.9); sonido.soplo(0.25, 0.08, 3.2, { corto: true }); sonido.nota(140, 0.25, 0.05, 'tri', { f1: 420 }); },   // ¡fshhh!: un chorro largo, un silbido y un empujón grave
    pisa(dron) {                                                 // el crujido de la madera o el chispazo del dron
      if (dron) { sonido.nota(1400, 0.1, 0.06, 'p12', { f1: 300 }); sonido.soplo(0.16, 0.1, 2.4, { corto: true }); }
      else { sonido.soplo(0.14, 0.12, 0.9, { corto: true }); sonido.nota(140, 0.12, 0.08, 'tri', { f1: 70 }); }
    },
    grind() { sonido.soplo(0.06, 0.025, 3.4, { corto: true }); },   // el roce del metal (un chispazo cortito, varias veces por segundo)
    chicle() { sonido.nota(523, 0.12, 0.07, 'p25', { f1: 880 }); },   // tomar el chicle
    revienta() { sonido.soplo(0.09, 0.12, 2.8, { corto: true }); sonido.nota(900, 0.08, 0.07, 'p12', { f1: 200 }); },   // ¡plop!
    energia(n) { sonido.nota(660 + n * 55, 0.07, 0.05, 'p25', { f1: 990 + n * 55 }); },   // una celda: un «tic» que sube con la carga
    llena() { for (const [k, f] of [[0, 523], [1, 659], [2, 784], [3, 1047]]) setTimeout(() => sonido.nota(f, 0.12, 0.06, 'p25'), k * 60); },   // tabla cargada: un arpegio
    rebote() { sonido.nota(260, 0.22, 0.09, 'tri', { f1: 620 }); },   // ¡boing! de la burbuja
    burbujas() { sonido.nota(520, 0.12, 0.07, 'tri', { f1: 980 }); sonido.nota(780, 0.16, 0.05, 'tri', { f1: 1460, t: sonido.t + 0.07 }); },   // blup-blup al entrar a las burbujas
    pisoton() { sonido.soplo(0.1, 0.06, 2.4, { corto: true }); sonido.nota(520, 0.1, 0.05, 'tri', { f1: 160 }); },   // ¡fiuu!: el pisotón del chicle, un soplido que baja
    rejilla() { sonido.nota(180, 0.18, 0.09, 'p12', { f1: 90 }); sonido.soplo(0.2, 0.12, 1.2, { corto: true }); },   // la rejilla que cede
    transbordo(n) { sonido.nota(587 + n * 147, 0.1, 0.07, 'p25', { f1: 880 + n * 220 }); },   // saltar de riel a riel: más agudo con cada transbordo
    viga() { sonido.nota(110, 0.2, 0.08, 'p12', { f1: 220 }); sonido.soplo(0.08, 0.05, 2, { corto: true }); },   // agarrar la viga: un «clanc» de metal
    doble() { sonido.nota(880, 0.14, 0.06, 'p25', { f1: 1320 }); }   // el poder de monedas ×2
  };

  /** La altura del rebote del chicle saliendo desde `y` (el suelo, o el
      techo donde cayó): CITY.CHICLE.rebote sobre los pies, pero sin pasar de
      CITY.CHICLE.tope sobre la vía. Ejemplo: del suelo, 3,6 m (más que el
      techo de un vagón, 3,35); de un techo, 2,65 m más (hasta 6 m). */
  const alturaRebote = y => Math.max(0.6, Math.min(CITY.CHICLE.rebote, CITY.CHICLE.tope - y));

  /** Lo que dice el resumen según con qué chocaste (se suma a MOTIVOS de juego.js). */
  const MOTIVOS = { cajon: 'Chocaste con unos cajones', dron: 'Te diste con un dron', baranda: 'Chocaste con una baranda',
    cobertizo: 'Chocaste con un cobertizo', conducto: 'Te diste contra un conducto', seto: 'Te enredaste en un seto' };

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
        pisadas: 0, lonas: 0,                                    // cuántos cajones/drones rompió y cuántas lonas usó
        energia: 0,                                              // celdas de energía de la tabla (llena con CITY.ENERGIA_LLENA)
        monedas2: 0,                                             // segundos que le quedan a «monedas ×2»
        doble: false,                                            // ya usó el doble salto de las burbujas (en este salto)
        pisoton: false,                                          // va bajando de un pisotón con chicle (al caer, rebota)
        boing: false,                                            // acaba de caer de ese pisotón: rebota al empezar el próximo cuadro
        rebotando: false, golpeSuelo: false,                     // va subiendo de ese rebote; y si el pisotón cayó en el suelo (no en un techo)
        enBurbuja: false,                                        // está dentro de un tramo de burbujas (baja gravedad)
        burbujasVistas: 0, vapores: 0, golpeT: 0,                // cuántos tramos de burbujas y vapores lleva (para avisar las primeras veces), y lo que le queda al pisotón en el suelo
        enAireAntes: false, golpeAntes: false,                   // al empezar el cuadro: ¿en el aire? ¿bajando de golpe? (para la rejilla)
        riel: null, transbordos: 0,                              // el riel en que vas (zigzag) y cuántas veces saltaste de uno a otro sin tocar el suelo
        enViga: false, vigas: 0                                  // ¿vas sobre una viga de grúa?, y cuántas agarraste
      } : null;
    },
    /** Cuánto más alto salta (Nico: ×1,08; con chicle, CITY.CHICLE.salto más). Solo cambia la altura. */
    salto: c => ((c.ciudad && c.ciudad.ventaja.salto) || 1) * (c.ciudad && c.ciudad.chicle > 0 ? CITY.CHICLE.salto : 1),
    /** La gravedad de este cuadro: dentro de las burbujas, el 55 % (los saltos flotan). */
    gravedad: c => (c.ciudad && c.ciudad.enBurbuja ? CITY.BURBUJAS.gravedad : 1),
    /** ¿Puede saltar en el aire? Solo dentro de las burbujas, una vez por salto (el doble salto). */
    saltoAire(c) {
      const C = c.ciudad;
      if (!C || !C.enBurbuja || C.doble) return false;
      C.doble = true; son.rebote();
      return true;
    },
    /** «Rodar» en el aire con el chicle: el PISOTÓN del Bubble Gum de City.
        Baja de golpe igual que siempre (F.caidaRapida, y `rodarPend`, así que
        sigue siendo un pisotón: abre la rejilla y pisa cajones y drones por
        el doble), y además queda marcado: al caer, la burbuja rebota y te
        lanza alto (ver `fisica` y `antes`). Antes este rodar te subía 2,6 m
        en el aire, y eso se sentía como un doble salto, no como el chicle de
        City. Devuelve true si lo hizo (juego.js entonces no hace lo suyo). */
    rebota(c) {
      const C = c.ciudad, r = c.r;
      if (!C || C.chicle <= 0 || !r.enAire) return false;
      r.vy = -M.FISICA.caidaRapida; r.rodarPend = true; r.saltoBufer = -1;   // lo mismo que el rodar en el aire de juego.js
      if (!C.pisoton) son.pisoton();
      C.pisoton = true; C.rebotando = false;
      return true;
    },
    /** ¿El chicle atrae monedas ahora? Sí mientras dure y vaya en el aire
        (como en City: la burbuja trae las monedas que vuelan cerca). */
    imanChicle: c => !!(c.ciudad && c.ciudad.chicle > 0 && c.r.enAire),
    /** Cuánto vale una moneda ahora: 2 con «monedas ×2». */
    valorMoneda: c => (c.ciudad && c.ciudad.monedas2 > 0 ? 2 : 1),
    /** Una celda de energía tomada. Al llenarse avisa que la tabla está lista. */
    energia(c) {
      const C = c.ciudad;
      if (!C) return;
      if (C.energia >= CITY.ENERGIA_LLENA) { c.monedas += 5; return; }   // ya llena: cada celda de más son 5 monedas
      const vale = (C.ventaja && C.ventaja.energia) || 1;                // Dante: cada celda vale por dos
      C.energia = Math.min(CITY.ENERGIA_LLENA, C.energia + vale);         // suma, sin pasarse de la barra
      if (C.energia >= CITY.ENERGIA_LLENA) { son.llena(); aviso('¡Tabla cargada! H o dos toques para encenderla'); }
      else son.energia(C.energia);
    },
    /** ¿La energía está llena? (la tabla se enciende gratis) */
    tablaLista: c => !!(c.ciudad && c.ciudad.energia >= CITY.ENERGIA_LLENA),
    /** Carga la tabla de una vez (lo que la caja misteriosa da en City en
        lugar de una patineta de la tienda, que aquí no se usan). */
    cargaTabla(c) {
      const C = c.ciudad;
      if (!C || C.energia >= CITY.ENERGIA_LLENA) return false;     // ya llena: que la caja dé otra cosa
      C.energia = CITY.ENERGIA_LLENA; son.llena();
      return true;
    },
    /** Gasta la energía y devuelve lo que dura la tabla encendida. */
    usaTabla(c) { c.ciudad.energia = 0; return CITY.TABLA_SEG; },
    /** Lo que muestra el marcador de City: la energía y lo que le queda a «monedas ×2». */
    /** Lo que pinta el marcador de City. `burbuja`: null fuera del tramo;
        dentro, 'listo' si aún puedes saltar en el aire y 'usado' si ya lo
        gastaste en este salto (vuelve a 'listo' al tocar el suelo). */
    hud: c => (c.ciudad ? { energia: c.ciudad.energia, llena: CITY.ENERGIA_LLENA, monedas2: c.ciudad.monedas2,
      burbuja: c.ciudad.enBurbuja ? (c.ciudad.doble ? 'usado' : 'listo') : null } : null),
    /** Segundos de más que dura un poder (Lía: +3 s de imán). */
    extraPoder: (c, clase) => (c.ciudad && clase === 'iman' && c.ciudad.ventaja.iman) || 0,
    /** Al empezar la física del cuadro: dónde estaban los pies. */
    antes(c) {
      const C = c.ciudad;
      if (!C) return;
      C.yAntes = c.r.y; C.enAireAntes = c.r.enAire; C.golpeAntes = c.r.rodarPend;
      // ¿dentro de un tramo de burbujas? (ocupa los tres carriles)
      const antes = C.enBurbuja;
      C.enBurbuja = false;
      for (const o of c.activos) if (o.tipo === 'burbujas' && c.D >= o.d0 && c.D <= o.d0 + o.largo) { C.enBurbuja = true; break; }
      /* El rebote del chicle: el cuadro pasado cayó de un pisotón, y ahora la
         burbuja lo lanza. Va un cuadro después de caer, no en el mismo: en
         ese cuadro los choques todavía tienen que ver los pies bajando, o el
         cajón sobre el que cayó contaría como un choque de frente (pisar
         pide vy ≤ 0). La altura es la misma dentro de las burbujas (el
         impulso se mide con su gravedad), para que el tope se cumpla. */
      const r = c.r;
      if (C.boing) {
        C.boing = false;
        if (C.chicle > 0 && !r.enAire && c.poderes.mochila <= 0 && !c.pogo) {
          r.vy = M.impulso(alturaRebote(r.y) * (C.enBurbuja ? CITY.BURBUJAS.gravedad : 1));
          r.enAire = true; r.rodar = 0; r.rodarPend = false; r.saltoBufer = -1; r.ultSuelo = -1;   // se acabó la rodada del pisotón; sin coyote
          C.rebotando = true;
        }
      }
      /* Al entrar, lo que hay que hacer: sin esto, los muros de setos de los
         tres carriles parecían imposibles (nada decía que ahí el salto flota).
         Se avisa SIEMPRE al entrar: las dos primeras veces de cada carrera,
         la explicación entera; después, el recordatorio corto. Ejemplo: el
         tercer tramo dice solo «Burbujas: salto doble». Además el marcador
         muestra mientras estás adentro si el salto doble está listo. */
      if (C.enBurbuja && !antes) {
        son.burbujas();                                          // un «blup» al cruzar el arco
        aviso(C.burbujasVistas++ < 2 ? '¡Burbujas! Saltas más alto y puedes saltar otra vez en el aire: salta los setos' : 'Burbujas: salto doble');
      }
    },

    /** Después de mover al corredor (fisica en juego.js): las lonas, el
        deslizarse por la baranda y lo que le queda a la burbuja. `sop` es lo
        que M.soporte dijo que había bajo los pies, `t` el reloj del dibujo. */
    fisica(c, sop, dt, mundo, t) {
      const C = c.ciudad, r = c.r;
      if (!C) return;
      // 1) la lona: pisarla (desde el suelo) te lanza a 5,2 m, por encima de los techos
      //    (y el vapor: en toda su columna, aunque se le salte encima; ver CITY.enLona)
      if (c.poderes.mochila <= 0) for (const o of c.activos) {
        if (!CITY.enLona(o, r.x, c.D, r.y, c.Dantes, r.vy)) continue;
        o.usada = true; o.usadaT = t;                            // una vez cada una; usadaT hace que se hunda (o sople) en el dibujo
        const k = C.ventaja.lona || 1;                           // la ventaja de Sol: sube más
        // la lona lanza desde el suelo; el vapor te lleva a la misma altura desde donde estés (saltando ya ibas arriba)
        r.vy = o.variante === 'vapor' ? M.impulso(Math.max(0.6, CITY.LONA.altura * k - r.y)) : CITY.impulsoLona(k);
        r.enAire = true;
        if (o.variante === 'vapor' && !C.vapores++) aviso('¡El vapor te sube a los techos!');   // la primera vez en la carrera, qué pasó
        r.rodar = 0; r.saltoBufer = -1; r.ultSuelo = -1; r.rodarPend = false;
        C.pisoton = false;                                       // la lona manda: el pisotón del chicle no rebota después
        c.cuenta.saltos++; C.lonas++;
        if (o.variante === 'vapor') son.vapor(); else son.lona();   // el vapor suena a chorro, no a cama elástica
        if (mundo) mundo.chispa(r.x, r.y + 0.3, 0, o.variante === 'vapor' ? 0xffe0b0 : 0x6ad1ff);
        break;
      }
      // 2) la baranda: subido al riel (es lo que te sostiene y no vas en el aire) te deslizas
      const riel = sop && sop.apoyo && sop.apoyo.tipo === 'baranda' && !r.enAire;
      if (riel) {
        /* Un riel distinto del anterior sin haber tocado el suelo es un
           TRANSBORDO (los rieles en zigzag del Bulevar): cada uno suma 1 al
           multiplicador de las monedas del riel, hasta ×4. Ejemplo: tres
           rieles hechos enteros, el tercero paga 3 monedas cada 2 m. */
        if (C.riel && C.riel !== sop.apoyo) {
          C.transbordos = Math.min(3, C.transbordos + 1);
          son.transbordo(C.transbordos);
          aviso(`¡Transbordo! Monedas ×${C.transbordos + 1}`);
        }
        C.riel = sop.apoyo;
        C.grind += c.V * dt;
        while (C.grind >= 2) {                                   // una moneda cada 2 m (Bruno: dos)
          C.grind -= 2;
          const n = (C.ventaja.grind || 1) * (C.monedas2 > 0 ? 2 : 1) * (1 + C.transbordos);   // Bruno: dos; con monedas ×2, el doble; cada transbordo, uno más
          c.monedas += n; c.cuenta.monedas += n;
        }
        C.grindSon -= dt;
        if (C.grindSon <= 0) {                                   // el roce y las chispas, ~8 veces por segundo
          C.grindSon = 0.12; son.grind();
          if (mundo) mundo.chispa(r.x, r.y + 0.05, 0, 0xffd27a);
        }
      } else C.grind = 0;
      // 3) en el suelo se recupera el doble salto (y en el suelo de verdad se corta la racha de transbordos)
      const cayoPisoton = C.pisoton && !r.enAire;                // acaba de caer de un pisotón con chicle (en el suelo o en un techo)
      if (!r.enAire) { C.doble = false; C.pisoton = false; C.rebotando = false; }
      if (!r.enAire && !riel) { C.riel = null; C.transbordos = 0; }
      // la viga de la grúa: al agarrarla, un «clanc» (y la primera vez, qué hacer)
      const viga = !!(sop && sop.apoyo && sop.apoyo.tipo === 'viga' && !r.enAire);
      if (viga && !C.enViga) { C.vigas++; son.viga(); if (C.vigas === 1) aviso('¡Agarraste la viga! Te deja sobre los vagones'); }
      C.enViga = viga;
      // 4) la rejilla: caerle encima de golpe (el pisotón) la abre y suelta su escondite de monedas
      /* El pisotón «dura» 0,35 s en el suelo: antes solo valía el cuadro
         exacto en que se aterrizaba, a ±1,5 m de la rejilla, y eso era una
         ventana de 50 a 150 ms para apretar abajo en el aire (a 46 m/s,
         63 ms): casi nunca se abría. Ahora, aterrizar de un pisotón deja
         0,35 s en que la rejilla que se cruce (barrido entre cuadros) se
         abre. Ejemplo: a 46 m/s, aterrizar 10 m antes de la rejilla basta. */
      /* Con chicle, el pisotón rebota y uno ya no se queda en el suelo: los
         0,35 s siguen corriendo mientras sube del rebote (C.rebotando), si
         el pisotón cayó en el suelo (no en un techo). Así el chicle abre la
         rejilla igual que el pisotón de siempre. */
      if (!r.enAire && C.enAireAntes && (C.golpeAntes || cayoPisoton)) { C.golpeT = 0.35; C.golpeSuelo = r.y < 0.3; }   // acaba de caer de un pisotón
      else if (r.enAire && !C.rebotando) C.golpeT = 0;                    // en el aire no cuenta (salvo el rebote del chicle)
      else C.golpeT = Math.max(0, (C.golpeT || 0) - dt);                  // en el suelo (o rebotando) se va gastando
      const mR = CITY.REJILLA.largo / 2 + 0.6;                            // el medio largo de la rejilla, con margen
      if (C.golpeT > 0 && (C.rebotando ? C.golpeSuelo : r.y < 0.3)) for (const o of c.activos) {
        if (o.tipo !== 'rejilla' || o.abierta || o.d < Math.min(c.D, c.Dantes) - mR || o.d > Math.max(c.D, c.Dantes) + mR
            || Math.abs(r.x - M.CARRILES[o.carril]) > CITY.REJILLA.w) continue;
        o.abierta = true; o.abiertaT = t;
        const n = CITY.REJILLA.monedas * (C.ventaja.pisoton || 1) * (C.monedas2 > 0 ? 2 : 1);
        c.monedas += n; c.cuenta.monedas += n; C.pisadas++;
        son.rejilla();
        if (mundo) { mundo.chispa(r.x, r.y + 0.4, 0, 0xffe066); if (mundo.city && mundo.city.geiser) mundo.city.geiser(o); }
        aviso(`¡Escondite bajo la rejilla! +${n} monedas`);
        break;
      }
      // 4b) el pisotón con chicle cayó: la burbuja se aplasta y rebota (el impulso, al empezar el próximo cuadro: ver `antes`)
      if (cayoPisoton && C.chicle > 0) {
        C.boing = true; son.rebote();
        if (mundo && mundo.city && mundo.city.boing) mundo.city.boing(r.x, r.y);
      }
      // 5) monedas ×2 se gasta
      if (C.monedas2 > 0) C.monedas2 = Math.max(0, C.monedas2 - dt);
      // 6) la burbuja de chicle se gasta
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
      // el rebote: el dron, como en City, te lanza alto (a ~5,3 m: de techo en techo); el cajón, un saltito
      let h = o.tipo === 'dron' ? CITY.DRON_IMPULSO : 1.1;
      /* Con chicle y bajando de un pisotón, el cajón o el dron también hacen
         rebotar la burbuja: sube lo del rebote (si es más que lo suyo). Ya no
         queda un rebote pendiente para el suelo: este lo reemplaza. */
      const conChicle = C.chicle > 0 && (C.pisoton || C.boing);
      if (conChicle) { h = Math.max(h, alturaRebote(r.y)); C.pisoton = false; C.boing = false; C.rebotando = true; son.rebote(); if (mundo && mundo.city && mundo.city.boing) mundo.city.boing(r.x, r.y); }
      r.vy = M.impulso(h); r.enAire = true; r.rodarPend = false;
      son.pisa(o.tipo === 'dron');
      if (o.tipo === 'dron') son.lona();
      if (mundo) mundo.chispa(r.x, r.y + 0.3, 0, 0xffe066);
      aviso(o.tipo === 'dron' ? `¡Dron impulsor! +${n} monedas` : `¡Pisotón! +${n} monedas`);
      return true;
    },
    /** Un choque de frente con la burbuja puesta: revienta y te salva (como
        la patineta: 2 s sin chocar). Devuelve true si te salvó. */
    salva(c, mundo) {
      const C = c.ciudad;
      if (!C || C.chicle <= 0) return false;
      C.chicle = 0; c.invulnerable = 2; C.pisoton = false; C.boing = false;
      if (mundo && mundo.city) mundo.city.chicle(false, true);   // el reventón
      son.revienta();
      aviso('¡La burbuja de chicle te salvó!');
      return true;
    },
    /** Al caer (muere en juego.js): la burbuja se va. */
    cae(c, mundo) { if (c.ciudad) { c.ciudad.chicle = 0; c.ciudad.monedas2 = 0; c.ciudad.pisoton = c.ciudad.boing = false; if (mundo && mundo.city) mundo.city.chicle(false); } },
    /** Un poder recogido: si es de City (chicle, batería, monedas ×2), lo maneja City (y devuelve true). */
    poder(c, clase, mundo) {
      if (!c.ciudad) return false;
      if (clase === 'bateria') {                                 // la batería: la energía de la tabla, llena de una
        c.ciudad.energia = CITY.ENERGIA_LLENA; c.cuenta.poderes++;
        son.llena(); aviso('¡Batería! Tabla cargada: H o dos toques');
        return true;
      }
      if (clase === 'monedas2') {                                // cada moneda cuenta doble (no los puntos)
        c.ciudad.monedas2 = CITY.MONEDAS2_SEG; c.cuenta.poderes++;
        son.doble(); aviso(`¡Monedas ×2 por ${CITY.MONEDAS2_SEG} s!`);
        return true;
      }
      if (clase !== 'chicle') return false;
      c.ciudad.chicle = CITY.CHICLE.seg; c.cuenta.poderes++;     // dura 15 s o hasta que revienta
      if (mundo && mundo.city) mundo.city.chicle(true);
      son.chicle(); aviso('¡Chicle! Rueda en el aire: pisotón y rebote. Te salva de un choque');
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
