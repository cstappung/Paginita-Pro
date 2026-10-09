/* Metro Rush: el mundo City (juegos/club/metrorush/city.js, más su dibujo en
   mundo-city.js y su carrera en ciudad.js).

   Lo que se fija aquí:
   - los cinco distritos (umbrales en metros, su música, su paleta y su
     postal), la vuelta y la curva de velocidad de City, que leen el juego,
     el sonido, la cámara, el generador y el antitrampas;
   - el generador de City pone lo suyo (cajones, drones, barandas, lonas,
     estrellas secretas y el chicle) y nunca deja una carrera imposible: un
     robot con la física de verdad del juego (M.soporte, M.caja y lo de
     City: pisar, lonas, barandas) corre muchas semillas sin chocar, en
     City y en City sin ayudas; «City sin ayudas» no tiene ni un chicle;
   - cada mecánica, cuadro a cuadro: el cajón se salta o se pisa, el dron se
     rueda, la baranda se sube y se desliza, la lona te deja sobre los
     techos (o detrás de ellos) sin chocar, a toda velocidad y ritmo de cuadros;
   - la prueba del antitrampas rehace una carrera de City que toma estrellas
     secretas, y la pista clásica no cambió (sus huellas);
   - las postales y los personajes de City se guardan y se mezclan aparte;
   - el juego, el sonido y el mundo leen la curva de City (no la clásica). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const DIR = path.join(__dirname, '../../juegos/club/metrorush');
const M = require(path.join(DIR, 'motor.js')), MP = require(path.join(DIR, 'prueba.js'));
const C = M.CITY, F = M.FISICA, X = M.CARRILES;
const lee = f => fs.readFileSync(path.join(DIR, f), 'utf8');

/* ---------- La pista, como la genera el juego ----------
   Siempre 230 m por delante con la velocidad de la curva del modo, y con
   los pedidos que hace juego.js: el túnel antes de cada distrito y la postal
   del distrito (si se pide). Devuelve los objetos y los pedidos hechos. */
function pista(semilla, metros, modo, conPostales = false) {
  const g = M.crearGenerador(semilla, { modo }), curva = M.velocidadDe(modo), objs = [], pedidos = [];
  let D = 0, t = 0, actual = M.estacionDe(0, modo), cambio = null, tunel = null;
  if (conPostales && actual.boleto) { pedidos.push(['B', g.estado().dSig, actual.boleto, 420]); g.pedirBoleto(actual.boleto, 420); }
  while (D < metros) {
    const V = curva.velocidad(t); D += V * 0.05; t += 0.05;
    for (const o of g.generarHasta(D + 230, { V: Math.max(13, V) })) { objs.push(o); if (o.tipo === 'tunel' && cambio && !tunel) tunel = o; }
    const sig = M.siguienteUmbral(D, modo), e = M.estacionDe(sig - D < 220 ? sig : D, modo);
    if (!cambio && e.clave !== actual.clave) { cambio = e; pedidos.push(['T', g.estado().dSig, D + 40, e.id]); g.pedirTunel(D + 40, e.id); }
    if (cambio && tunel && D >= tunel.d0 + 40) {                 // dentro del túnel: cambia de distrito (y pide su postal)
      actual = cambio;
      if (conPostales && actual.boleto) { const d = tunel.d0 + tunel.largo + 260; pedidos.push(['B', g.estado().dSig, actual.boleto, d]); g.pedirBoleto(actual.boleto, d); }
      cambio = null; tunel = null;
    }
  }
  return { objs, pedidos, curva };
}

/* ---------- El robot ----------
   Corre con la física de juego.js (fisica y choques, copiados en corto) y
   con lo de City de ciudad.js (pisar, lonas, barandas). Sabe dos cosas:
   1) POR DÓNDE ir: un plan de carriles hecho con los tramos cerrados de
      verdad (un tren detenido al que no lleva una rampa, uno en marcha
      donde se cruza contigo, y también los trenes de las lonas: el camino
      no puede depender de la lona), recorrido de atrás hacia adelante (qué
      carril, en cada metro, todavía lleva al final). Cambiar de carril pide
      los dos libres durante lo que de verdad tarda (0,17 s a esa velocidad,
      con margen).
   2) QUÉ hacer con lo que viene por su carril: saltar barreras bajas,
      cajones y barandas; rodar bajo barreras altas y drones; nada con las
      rampas (se suben) ni con las lonas.
   Falla si choca de frente o si tropieza dos veces seguidas (lo atraparían). */
function cerrados(objs, hasta, curva) {
  const N = Math.ceil(hasta) + 2, libre = [0, 1, 2].map(() => new Uint8Array(N).fill(1));
  const trenes = objs.filter(o => o.tipo === 'tren'), subible = new Set();
  for (const r of objs.filter(o => o.tipo === 'rampa')) {        // una rampa sube a su tren (y a los pegados a él)
    let fin = r.d0 + r.largo;
    for (;;) { const t = trenes.find(x => x.vel === 0 && x.carril === r.carril && Math.abs(x.d0 - fin) < 0.6); if (!t) break; subible.add(t); fin = t.d0 + t.largo; }
  }
  const lonaDe = new Map();
  /* Una lona (o el vapor) también lleva arriba: los vagones que la siguen
     en su carril se recorren por los techos (el robot salta de verdad). */
  for (const l of objs.filter(o => o.tipo === 'lona')) {
    let t = trenes.find(x => x.vel === 0 && x.carril === l.carril && x.d0 > l.d && x.d0 - l.d < 16);
    if (t) lonaDe.set(t, l);                                       // y para llegar a ellos hay que pasar por la lona: centrado en su carril
    while (t) { subible.add(t); const fin = t.d0 + t.largo; t = trenes.find(x => x.vel === 0 && x.carril === l.carril && Math.abs(x.d0 - fin) < 0.6); }
  }
  /* `libre`: se puede seguir por ahí; `entra`: además se puede LLEGAR ahí
     cambiándose de carril. Un vagón al que lleva una rampa se recorre por
     arriba, pero solo si se subió por la rampa: entrar de lado a media rampa
     o a media fila de vagones es chocar con su costado. Lo mismo meterse de
     lado a media baranda, o justo donde está un cajón, un dron o una
     barrera (no da tiempo de saltar o rodar). */
  const entra = [0, 1, 2].map(() => new Uint8Array(N).fill(1)), burbujas = objs.filter(o => o.tipo === 'burbujas');
  const cierra = (l, c, a, b) => { for (let d = Math.max(0, Math.floor(a)); d <= Math.min(N - 1, Math.ceil(b)); d++) l[c][d] = 0; };
  for (const t of trenes) {
    if (t.vel > 0) { cierra(libre, t.carril, t.dArribo - 1, t.dArribo + t.largo + 1); cierra(entra, t.carril, t.dArribo - 1, t.dArribo + t.largo + 1); }
    else { if (!subible.has(t)) cierra(libre, t.carril, t.d0 - 0.4, t.d0 + t.largo + 0.4); cierra(entra, t.carril, lonaDe.has(t) ? lonaDe.get(t).d - 1.5 : t.d0 - 1, t.d0 + t.largo + 0.4); }
  }
  for (const o of objs) {
    /* Una rampa no choca mientras su superficie esté a menos de 0,6 m
       (`caja` de motor.js): su primer metro se puede tomar llegando de lado. */
    if (o.tipo === 'rampa') cierra(entra, o.carril, o.d0 + 0.5, o.d0 + o.largo + 1);
    else if (o.tipo === 'baranda') cierra(entra, o.carril, o.d0 - 1, o.d0 + o.largo + 1);
    else if (['cajon', 'dron', 'bajo', 'alto'].includes(o.tipo)) cierra(entra, o.carril, o.d - 2, o.d + 1.5);
    /* Al carril de un seto se entra con tiempo de saltar flotando (el salto
       tiene que salir antes de 0,62 s): de lado y encima, ya no. */
    else if (o.tipo === 'seto') {
      if (burbujas.some(b => o.d >= b.d0 && o.d <= b.d0 + b.largo)) cierra(entra, o.carril, o.d - curva.velocidadEn(o.d) * 0.7, o.d + 1.5);
      else cierra(libre, o.carril, o.d - 1, o.d + 1.5);          // fuera de las burbujas un seto es un muro: no se pasa (como un vagón)
    }
    /* El cobertizo y la viga son la ruta de arriba (como la lona): su carril
       se da por cerrado hasta el final de sus vagones (esos ya los cierra el
       bucle de los trenes); el camino nunca depende de ellos. El conducto se
       pasa rodando: se sigue por él, pero no se entra de lado. */
    else if (o.tipo === 'cobertizo' || o.tipo === 'viga') { cierra(libre, o.carril, o.d0 - 1, o.d0 + o.largo + 1); cierra(entra, o.carril, o.d0 - 3, o.d0 + o.largo + 1); }
    else if (o.tipo === 'conducto') cierra(entra, o.carril, o.d0 - 2, o.d0 + o.largo + 1);
  }
  for (let c = 0; c < 3; c++) for (let d = 0; d < N; d++) if (!libre[c][d]) entra[c][d] = 0;
  return { libre, entra };
}
function plan(objs, hasta, curva) {
  const { libre, entra } = cerrados(objs, hasta, curva), N = libre[0].length;
  /* Un cambio de carril que empieza en el metro d, a la velocidad V de ahí
     (cruza 2,2 m en 0,17 s): sale del alcance de lo que hay en su carril
     (1,33 m de lado, un vagón) a los 0,103 s, y entra en el del otro a los
     0,067 s. Así que su carril tiene que seguir libre ~0,11·V m más, y el
     otro estar libre (y ser «entrable») desde ~0,06·V m hasta que termina
     de cambiarse. Un metro de margen en cada punta. */
  const K = d => Math.ceil(curva.velocidadEn(d) * 0.17) + 1;
  const bien = [0, 1, 2].map(() => new Uint8Array(N));
  for (let c = 0; c < 3; c++) bien[c][N - 1] = libre[c][N - 1];
  // `cabe`: el cambio en sí cabe (su carril sigue libre lo que tarda en salir, el otro se puede entrar); `cambia`: y además llega a un carril bien
  const cabe = (c, o, d) => {
    const V = curva.velocidadEn(d), k = K(d), sale = Math.ceil(V * 0.11) + 1, llega = Math.max(0, Math.floor(V * 0.06) - 1);
    if (d + k >= N) return false;
    for (let x = 0; x <= sale; x++) if (!libre[c][d + x]) return false;
    for (let x = llega; x <= k; x++) if (!entra[o][d + x]) return false;
    return true;
  };
  const cambia = (c, o, d) => cabe(c, o, d) && !!bien[o][d + K(d)];
  // de atrás hacia adelante: un carril está bien en d si está libre y sigue bien en d+1, o si desde ahí se puede cambiar a uno que esté bien
  for (let d = N - 2; d >= 0; d--) for (let c = 0; c < 3; c++) {
    if (!libre[c][d]) continue;
    if (bien[c][d + 1] || [c - 1, c + 1].some(o => o >= 0 && o <= 2 && cambia(c, o, d))) bien[c][d] = 1;
  }
  return { libre, entra, bien, cambia, cabe, K };
}

const DEPIE = new Set(['bajo', 'cajon', 'baranda']), RUEDA = new Set(['alto', 'dron', 'conducto']);
const frente = o => o.d != null ? o.d - 0.6 : o.d0;             // dónde empieza (cajón, dron y barreras: su centro menos un poco)
function robot(objs, modo, metros, { fps = 60, curva = M.velocidadDe(modo), P = null } = {}) {
  const cosas = objs.filter(o => ['tren', 'rampa', 'bajo', 'alto', 'cajon', 'dron', 'baranda', 'lona', 'cobertizo', 'viga', 'conducto', 'seto', 'burbujas'].includes(o.tipo)).map(o => Object.assign({}, o))
    .sort((a, b) => (a.vel > 0 ? a.dArribo - 260 : (a.d ?? a.d0)) - (b.vel > 0 ? b.dArribo - 260 : (b.d ?? b.d0)));
  const pl = P || plan(objs, metros + 300, curva), dt = 1 / fps;
  /* El plan, cuadro a cuadro. El plan por metros dice dónde se PUEDE
     cambiar de carril, pero a 20 cuadros/s y 58 m/s un cuadro son 2,9 m: si
     la única salida es un metro justo, el robot salta de largo por encima de
     ella (se vio: cambiar recién a los 14 039 m, ni antes ni después). Como
     la velocidad sale de la curva, dónde cae cada cuadro se sabe de antemano
     (`Ds`), y `bienF[c][n]` dice si desde el cuadro n en el carril c hay
     salida contando solo los metros en que de verdad habrá un cuadro. */
  const Ds = [0];
  for (let tt = 0, DD = 0; DD < metros + 5;) { const V = curva.velocidad(tt); tt += dt; DD += V * dt; Ds.push(DD); }   // igual que el bucle de abajo
  const nF = Ds.length, bienF = [0, 1, 2].map(() => new Uint8Array(nF + 1).fill(1));
  const cuadroDe = d => { let a = 0, b = nF - 1; while (a < b) { const m = (a + b) >> 1; if (Ds[m] >= d) b = m; else a = m + 1; } return a; };   // el primer cuadro en o pasado d
  const saleA = (c, n) => { const d = Math.floor(Ds[n]); return [c - 1, c + 1].find(o => o >= 0 && o <= 2 && pl.cabe(c, o, d) && bienF[o][cuadroDe(d + pl.K(d))]); };
  for (let n = nF - 1; n >= 0; n--) for (let c = 0; c < 3; c++) {
    const d = Math.floor(Ds[n]);
    bienF[c][n] = pl.libre[c][d] && (bienF[c][n + 1] || saleA(c, n) != null) ? 1 : 0;
  }
  let nC = 0;                                                   // el cuadro en que va
  const r = { x: X[1], xPrev: X[1], carril: 1, carrilPrev: 1, y: 0, vy: 0, enAire: false, rodar: 0, rodarPend: false, bufer: -1 };
  let D = 0, Dantes = 0, t = 0, i = 0, tropiezo = -99, pisadas = 0, lonas = 0, grind = 0, setos = 0, conductos = 0, doble = false;
  const activos = [];
  const cuenta = { saltos: 0, rodadas: 0, techos: 0 };
  while (D < metros) {
    const V = curva.velocidad(t);
    t += dt; Dantes = D; D += V * dt;
    // la ventana de la pista: lo que tiene por delante (como c.activos)
    while (i < cosas.length && (cosas[i].vel > 0 ? cosas[i].dArribo - 260 : (cosas[i].d ?? cosas[i].d0)) < D + 230) activos.push(cosas[i++]);
    for (let k = activos.length - 1; k >= 0; k--) {
      const o = activos[k];
      if (o.tipo === 'tren' && o.vel > 0) { M.activaTren(o, D, V); if (o.activo) o.d0 -= o.vel * dt; }
      const fin = o.d != null ? o.d : o.d0 + (o.largo || 0);
      if (fin < D - 15) activos.splice(k, 1);
    }
    // 1) por dónde: el plan de carriles
    const dI = Math.floor(D);
    nC++;                                                       // (D ya es Ds[nC])
    const quedarse = !!bienF[r.carril][nC + 1];                 // el próximo cuadro en este carril todavía tiene salida
    if (Math.abs(r.x - X[r.carril]) < 1e-6 && !quedarse) {
      const o = saleA(r.carril, nC);
      if (o != null) { r.carrilPrev = r.carril; r.carril = o; }
    }
    // 2) qué hacer con lo que viene por su carril (o por el que se está cambiando)
    const salta = () => { r.vy = M.impulso(F.alturaSalto); r.enAire = true; r.rodar = 0; r.rodarPend = false; r.bufer = -1; cuenta.saltos++; };
    if (r.bufer > 0) { r.bufer -= dt; if (!r.enAire) salta(); }   // el búfer del salto (juego.js): pedido en el aire, sale al tocar el suelo
    const alto = r.y > 2.5 && !r.enAire;                          // de pie arriba de un tren: nada lo alcanza
    // las burbujas del parque (ciudad.antes): dentro, la gravedad baja y hay un salto más en el aire
    const enBurbuja = activos.some(o => o.tipo === 'burbujas' && D >= o.d0 && D <= o.d0 + o.largo);
    if (!r.enAire) doble = false;
    if (!alto) for (const o of activos) {
      if (o.carril !== r.carril || o.roto) continue;
      const dz = frente(o) - D;
      /* El seto: solo flotando. Salta cuando le faltan 0,38 a 0,62 s (el
         salto flotante pasa de 2,8 m entre los 0,35 y los 1,11 s); si va en
         el aire y cayendo sin más no le pasaría por encima, usa el salto de
         más de las burbujas. */
      if (o.tipo === 'seto') {
        if (!activos.some(b => b.tipo === 'burbujas' && o.d >= b.d0 && o.d <= b.d0 + b.largo)) continue;   // fuera de las burbujas es un muro: lo esquiva el plan
        const ventana = dz > V * 0.38 + 0.6 && dz < V * 0.62;
        if (ventana && !r.enAire) { salta(); setos++; }
        else if (ventana && r.enAire && enBurbuja && !doble && r.vy < 0) { const tz = (dz + 1.2) / V, g = F.gravedad * C.BURBUJAS.gravedad; if (r.y + r.vy * tz - g * tz * tz / 2 < C.SETO.alto + 0.3) { r.vy = M.impulso(F.alturaSalto); doble = true; setos++; } }
        continue;
      }
      // el conducto: rodar desde la entrada y volver a rodar adentro hasta salir (dz es negativo adentro)
      if (o.tipo === 'conducto') {
        const sale = o.d0 + o.largo - D;
        if (dz < V * 0.25 + 0.8 && sale > -0.6 && r.rodar < (sale + 1.2) / V + dt && !r.rodarPend) {   // (+ un cuadro: a 20 cuadros/s la rodada se acababa justo en la salida)
          if (r.enAire) { r.vy = -F.caidaRapida; r.rodarPend = true; } else { if (r.rodar <= 0) conductos++; r.rodar = F.tiempoRodar; cuenta.rodadas++; }
        }
        continue;
      }
      if (DEPIE.has(o.tipo) && dz > 0 && dz < V * 0.2 + 0.4 && !(o.tipo === 'baranda' && r.y >= 0.9)) {
        if (!r.enAire) salta(); else if (r.vy <= 0 && r.y < 0.9) r.bufer = 0.16;   // cayendo y bajo: lo pide (como el búfer de juego.js)
      }
      /* Cayendo (de un techo, o de un salto largo: 0,8 s en el aire) hacia
         algo que hay que saltar: baja de golpe (rodar en el aire, como haría
         una persona) para tocar el suelo a tiempo de saltar. Si viene muy encima, cayendo sin más lo pisa; y si
         cayendo sin más ya le pasa por encima (una lona lo lanzó alto), no. */
      const tz = (dz + 1.2) / V, yLlega = r.y + r.vy * tz - F.gravedad * tz * tz / 2;   // la altura con que dejaría atrás la cosa cayendo sin más
      // (ya pasó lo que saltaba: nada debajo ni justo delante, o caería encima)
      const debajo = activos.some(q => q !== o && q.carril === r.carril && !q.roto && q.tipo !== 'tren' && q.tipo !== 'lona'
        && (q.d != null ? Math.abs(q.d - D - V * 0.04) < 1 + V * 0.06 : q.d0 < D + V * 0.1 && q.d0 + q.largo > D - 1));
      if (DEPIE.has(o.tipo) && r.enAire && r.y > 0.9 && r.vy < 3 && dz > V * 0.2 && dz < V * 0.6 && !r.rodarPend && yLlega < 1.2 && !debajo
        && !activos.some(t => t.tipo === 'tren' && t.carril === r.carril && t.d0 + t.largo > D - 0.5 && t.d0 < frente(o))) {
        r.vy = -F.caidaRapida; r.rodarPend = true;
      }
      /* Bajando de un techo hacia una lona: si cayendo sin más pasaría por
         encima sin tocarla (y se estrellaría con los vagones que la siguen),
         baja de golpe para pisarla. */
      if (o.tipo === 'lona' && !o.usada && r.enAire && r.y > 0.35 && r.vy < 3 && !r.rodarPend) {
        const dl = o.d - D, tl = (dl + 0.6) / V, yL = r.y + r.vy * tl - F.gravedad * tl * tl / 2;
        if (dl > 0 && dl < V * 0.7 && yL > 0.3) { r.vy = -F.caidaRapida; r.rodarPend = true; }
      }
      // rueda (o vuelve a rodar, como en juego.js: «abajo» rodando reinicia la rodada) si la rodada no le alcanza para pasar
      if (RUEDA.has(o.tipo) && dz > 0 && dz < V * 0.25 + 0.8 && r.rodar < (dz + 1.2) / V && !r.rodarPend) {
        // en el aire baja de golpe, salvo que cayendo sin más ya le pase por encima (bajando de un techo; con margen por el paso de la física a pocos cuadros)
        const tz = (dz + 1.2) / V, yPasa = r.y + r.vy * tz - F.gravedad * tz * tz / 2, cj = M.caja(o, D);
        if (r.enAire) { if (!(cj && yPasa > cj.y1 + 0.35)) { r.vy = -F.caidaRapida; r.rodarPend = true; } } else { r.rodar = F.tiempoRodar; cuenta.rodadas++; }
      }
    }
    // 3) la física (fisica en juego.js)
    const yAntes = r.y;
    const vl = 2.2 / F.cambioCarril;
    r.xPrev = r.x; r.x += Math.max(-vl * dt, Math.min(vl * dt, X[r.carril] - r.x));
    const sop = M.soporte(activos, r.x, D, r.y, Dantes);
    r.vy -= F.gravedad * (enBurbuja ? C.BURBUJAS.gravedad : 1) * dt; r.y += r.vy * dt;
    if (r.y <= sop.h) {
      if (r.enAire && r.rodarPend) { r.rodar = F.tiempoRodar; }
      r.y = sop.h; r.vy = 0; r.enAire = false; r.rodarPend = false;
    } else if (!r.enAire && r.y > sop.h + 0.05) r.enAire = true;
    if (sop.tren) cuenta.techos++;
    // lo de City después de mover (ciudad.fisica): la lona y el riel
    // igual que ciudad.js: la comprobación barre el tramo del cuadro (Dantes→D) y el vapor sopla en toda su columna
    for (const o of activos) if (C.enLona(o, r.x, D, r.y, Dantes, r.vy)) {
      o.usada = true;                                             // una vez cada una
      r.vy = o.variante === 'vapor' ? M.impulso(Math.max(0.6, C.LONA.altura - r.y)) : C.impulsoLona(1);
      r.enAire = true; r.rodar = 0; lonas++; break;
    }
    if (sop.apoyo && sop.apoyo.tipo === 'baranda' && !r.enAire) grind += V * dt;
    if (r.rodar > 0) r.rodar -= dt;
    // 4) los choques (choques en juego.js, con el pisotón de City)
    if (r.y <= 6) {
      const altoR = r.rodar > 0 ? F.altoRodando : F.altoDePie, dD = D - Dantes;
      for (const o of activos) {
        const k = M.caja(o, D);
        if (!k || k.y1 <= k.y0) continue;
        let xs = r.x, ys = r.y;
        if (D + M.MEDIO_LARGO < k.z0 || D - M.MEDIO_LARGO > k.z1) {
          // el barrido de juego.js: una pieza más corta que el cuadro se mira en el instante en que se la cruzó
          const ancho = k.z1 - k.z0 + 2 * M.MEDIO_LARGO;
          if (ancho >= dD || Dantes - M.MEDIO_LARGO > k.z1 || D + M.MEDIO_LARGO < k.z0) continue;
          const s0 = Math.max(0, (k.z0 - M.MEDIO_LARGO - Dantes) / dD), s1 = Math.min(1, (k.z1 + M.MEDIO_LARGO - Dantes) / dD), sm = (s0 + s1) / 2;
          xs = r.xPrev + (r.x - r.xPrev) * sm; ys = yAntes + (r.y - yAntes) * sm;
        }
        const Xo = X[o.carril], lim = k.w + F.medioAncho;
        if (Math.abs(xs - Xo) >= lim) continue;
        if (ys + 0.02 >= k.y1 || ys + altoR <= k.y0) continue;
        if (C.pisa(o, yAntes, r.vy)) { o.roto = true; pisadas++; r.vy = M.impulso(1.1); r.enAire = true; continue; }
        const deCostado = Math.abs(r.xPrev - Xo) >= lim - 0.02;
        if (!deCostado) return { choque: { tipo: o.tipo, carril: o.carril, d: +(o.d ?? o.d0).toFixed(1), D: +D.toFixed(1), y: +r.y.toFixed(2), x: +r.x.toFixed(2), V: +V.toFixed(1), rodar: r.rodar > 0 }, D, pisadas, lonas, grind, cuenta };
        if (t - tropiezo < F.ventanaTropiezo) return { choque: { tipo: 'atrapado', por: o.tipo, D: +D.toFixed(1) }, D, pisadas, lonas, grind, cuenta };
        tropiezo = t; r.carril = r.carrilPrev; r.x = r.xPrev - Math.sign(Xo - r.xPrev) * 0.05;
        break;
      }
    }
  }
  return { choque: null, D, pisadas, lonas, grind, cuenta, setos, conductos, tropiezos: tropiezo > 0 };
}

/* ---------- los datos ---------- */

test('los cinco distritos: en metros, con su música, su paleta, su escenografía y su postal', () => {
  const E = M.ESTACIONES_CITY;
  assert.equal(E, C.DISTRITOS); assert.equal(E.length, 5);
  assert.deepEqual(E.map(e => e.musica), ['city-sur', 'city-muelles', 'city-bulevar', 'city-parque', 'city-bajo']);
  assert.deepEqual(E.map(e => e.distrito), ['sur', 'muelles', 'bulevar', 'parque', 'bajo']);
  assert.deepEqual(E.map(e => e.boleto), [1, 2, 3, 4, 5]);
  for (let k = 1; k < E.length; k++) assert.ok(E[k].desde > E[k - 1].desde, 'los umbrales crecen');
  assert.equal(E[0].desde, 0);
  const audio = lee('audio.js'), dibujo = lee('mundo-city.js');
  for (const e of E) {
    assert.ok(['juguete', 'pixel', 'neon'].includes(e.estilo), e.id);
    assert.match(audio, new RegExp(`'${e.musica}': \\[`), e.id + ': su lista de temas');
    assert.match(dibujo, new RegExp(`\\n  ${e.paleta}: variante\\(`), e.id + ': su paleta en mundo-city.js');
    assert.equal(M.estacionDe(e.desde + 1, 'city').id, e.id);
    assert.ok(C.POSTALES[e.boleto] && C.POSTALES[e.boleto].titulo && C.POSTALES[e.boleto].texto, e.id + ': su postal');
  }
  assert.equal(C.POSTALES.length, 6); assert.equal(C.POSTALES[0], null);
  assert.equal(M.INTRO_CITY, C.INTRO); assert.ok(M.INTRO_CITY.length > 100);
  // la vuelta: desde los 13 km, cada 3 km, sin postal
  const v = M.estacionDe(13500, 'city'); assert.match(v.nombre, /vuelta 2/); assert.ok(!v.boleto);
  assert.equal(M.estacionDe(16500, 'citypuro').distrito, 'muelles');
  assert.equal(M.siguienteUmbral(9500, 'city'), 13000);
  // la postal de un mundo no es de otro: City lleva sus cinco postales y la Línea 3 sus boletos, en otra lista
  assert.equal(M.historiaDe('city').boletos, C.POSTALES); assert.notEqual(M.BOLETOS, C.POSTALES);
  assert.ok(M.BOLETOS.length > C.POSTALES.length, 'los boletos de la Línea 3 no se mezclan con las postales');
});

test('la velocidad de City: su propia curva, la misma para el juego, el generador y el antitrampas', () => {
  const V = M.velocidadDe('city'), Vp = M.velocidadDe('citypuro'), Vf = M.velocidadDe('cityfantasma'), Vc = M.velocidadDe('clasico');
  assert.equal(V, Vp); assert.equal(V, Vf); assert.notEqual(V, Vc);
  assert.equal(V.VELOCIDAD, C.VELOCIDAD); assert.deepEqual(C.VELOCIDAD, { V0: 16, VMAX: 60, ACEL: 0.11 });
  assert.equal(V.velocidad(0), 16); assert.equal(V.velocidad(1e4), 60);
  // la curva de la versión 2 (tope 46) queda para rehacer las pruebas de antes, y hasta su tope es la misma
  const V2 = M.velocidadDe('city', 2); assert.equal(V2.velocidad(1e4), 46);
  for (let t = 0; t < 270; t += 5) assert.equal(V2.velocidad(t), V.velocidad(t));
  assert.ok(Math.abs(V.velocidadEn(V.metrosEntre(0, 100)) - V.velocidad(100)) < 1e-6, 'velocidadEn y metrosEntre son la misma curva');
  // el juego le pasa la curva de la carrera al mundo (la cámara) y al sonido (el tempo)
  const juego = lee('juego.js'), ciudad = lee('ciudad.js'), mundo = lee('mundo.js'), audio = lee('audio.js');
  assert.match(juego, /ciudad\.inicia\(c, progreso, mundo\)/);
  assert.match(ciudad, /mundo\.curva\(V\)/); assert.match(ciudad, /sonido\.curva\(V\)/);
  assert.match(mundo, /curva\(V\) \{ if \(V && V\.VMAX > V\.V0\) VEL = V; \}/);
  assert.match(audio, /curva\(V\) \{ if \(V && V\.VMAX > V\.V0\) VEL = V; \}/);
  assert.match(juego, /c\.curva\.VELOCIDAD : M\.VELOCIDAD\)\.V0/);
});

test('los personajes de City: chicas y chicos, con una ventaja chica que no toca los puntos', () => {
  const P = C.PERSONAJES, ids = Object.keys(P);
  assert.ok(ids.length >= 4); assert.equal(M.MUNDOS.city.personajes, P);
  const pelos = new Set(['corto', 'coleta', 'melena', 'trenzas', 'rapado']);
  for (const id of ids) {
    const p = P[id];
    assert.equal(p.id, id); assert.ok(p.precio > 0 && p.nombre && p.texto);
    assert.ok(pelos.has(p.apariencia.peinado), id + ': su peinado');
    for (const k of ['sudadera', 'gorra', 'jeans', 'mochila', 'mochila2', 'suela', 'piel', 'pelo']) assert.equal(typeof p.apariencia[k], 'number', id + '.' + k);
    // una sola ventaja, de las que no cambian ni los metros ni el multiplicador
    const v = Object.keys(p.ventaja); assert.equal(v.length, 1, id);
    assert.ok(['iman', 'salto', 'pisoton', 'grind', 'lona', 'energia'].includes(v[0]), id);
    assert.ok(p.ventaja[v[0]] > 0 && p.ventaja[v[0]] <= 3, id + ': chica');
    assert.equal(C.ventajaDe(id), p.ventaja);
  }
  // tres chicas y tres chicos (Dante llegó para emparejar)
  const chicas = ['lia', 'ambar', 'sol'], chicos = ['nico', 'bruno', 'dante'];
  assert.deepEqual([...ids].sort(), [...chicas, ...chicos].sort());
  assert.ok(ids.some(k => P[k].apariencia.falda), 'hay faldas'); assert.ok(ids.some(k => !P[k].apariencia.falda), 'y pantalones');
  assert.deepEqual(C.ventajaDe('clasico'), {}); assert.deepEqual(C.ventajaDe(null), {});
  // el salto de Nico (2,27 m) no pasa por encima de un dron (2,45) ni llega a pisarlo (eso solo desde un techo o una lona)
  assert.ok(F.alturaSalto * P.nico.ventaja.salto < C.DRON.y1 - C.PISA_DRON - 0.01);
});

test('progreso: las postales y los personajes de City se guardan aparte y se suman entre aparatos', () => {
  const p = M.limpiaProgreso({ boletosCity: [3, 1, 3, 9, 0, 'x'], personajesCity: ['lia', 'nope', 'lia'], personajeCity: 'nope', boletos: [2] });
  assert.deepEqual(p.boletosCity, [1, 3]); assert.deepEqual(p.personajesCity, ['lia']); assert.equal(p.personajeCity, null);
  assert.deepEqual(p.boletos, [2], 'los boletos de la Línea 3 no se tocan');
  assert.equal(M.limpiaProgreso({ personajesCity: ['sol'], personajeCity: 'sol' }).personajeCity, 'sol');
  assert.equal(M.limpiaProgreso({ personajesCity: [], personajeCity: 'sol' }).personajeCity, null, 'no se pone uno que no es suyo');
  const a = Object.assign(M.limpiaProgreso({ boletosCity: [1], personajesCity: ['lia'], personajeCity: 'lia' }), { at: 1 });
  const b = Object.assign(M.limpiaProgreso({ boletosCity: [4], personajesCity: ['bruno'], personajeCity: 'bruno' }), { at: 2 });
  const m = M.mezclaProgreso(a, b);
  assert.deepEqual(m.boletosCity, [1, 4]); assert.deepEqual(m.personajesCity.sort(), ['bruno', 'lia']); assert.equal(m.personajeCity, 'bruno');
  const n = M.progresoNuevo(); assert.deepEqual([n.boletosCity, n.personajesCity, n.personajeCity], [[], [], null]);
});

/* ---------- la pista ---------- */

test('la pista de City tiene lo suyo; «City sin ayudas» ni un poder ni un chicle; la misma semilla da la misma pista', () => {
  const city = pista(2026, 10500, 'city').objs, puro = pista(2026, 10500, 'citypuro').objs;   // hasta Bajo Vías (9 km) y un poco más
  const cuenta = (l, f) => l.filter(f).length;
  for (const t of ['cajon', 'dron', 'baranda', 'lona']) { assert.ok(cuenta(city, o => o.tipo === t) > 5, 'city: ' + t); assert.ok(cuenta(puro, o => o.tipo === t) > 5, 'citypuro: ' + t); }
  assert.ok(cuenta(city, o => o.tipo === 'poder' && o.clase === 'chicle') >= 3, 'hay chicles');
  assert.ok(cuenta(city, o => o.tipo === 'estrella' && o.secreta) >= 5, 'hay estrellas secretas');
  assert.ok(cuenta(puro, o => o.tipo === 'estrella' && o.secreta) >= 5, 'también sin ayudas');
  assert.equal(cuenta(puro, o => o.tipo === 'poder' || o.tipo === 'caja'), 0, 'sin ayudas: ni poderes, ni cajas, ni chicles');
  assert.ok(cuenta(city, o => o.tipo === 'lona' && o.variante === 'vapor') > 0, 'Bajo Vías tiene vapor');
  // los tipos nuevos están registrados (M.caja los conoce) y la lona no choca
  for (const t of ['cajon', 'dron', 'baranda', 'lona']) assert.ok(M.TIPOS[t], t);
  assert.equal(M.caja({ tipo: 'lona', d: 10, carril: 0 }, 10), null);
  assert.equal(M.caja({ tipo: 'cajon', d: 10, carril: 0, roto: true }, 10), null, 'un cajón roto ya no choca');
  // determinista
  const h = l => crypto.createHash('sha256').update(JSON.stringify(l)).digest('hex');
  assert.equal(h(pista(77, 4000, 'city').objs), h(pista(77, 4000, 'city').objs));
  assert.notEqual(h(pista(77, 4000, 'city').objs), h(pista(77, 4000, 'citypuro').objs));
});

test('lo de Subway Surfers City: energía de la tabla, rejillas, contenedores que caen, burbujas y los poderes nuevos', () => {
  const city = pista(2026, 10500, 'city').objs, puro = pista(2026, 10500, 'citypuro').objs;
  const de = (l, t) => l.filter(o => o.tipo === t);
  // las celdas de energía cargan la tabla: solo donde hay patineta (en «sin ayudas» no hay qué cargar)
  assert.ok(de(city, 'energia').length > 30, 'city: celdas de energía');
  assert.equal(de(puro, 'energia').length, 0, 'citypuro: ni una celda');
  // los poderes nuevos (batería y monedas ×2) solo con poderes
  for (const k of ['bateria', 'monedas2']) {
    assert.ok(city.some(o => o.tipo === 'poder' && o.clase === k), 'city: ' + k);
    assert.ok(!puro.some(o => o.tipo === 'poder' && o.clase === k), 'citypuro: sin ' + k);
  }
  // rejillas en los dos modos (no son una ayuda: se ganan con un pisotón), espaciadas según el distrito
  // (el Barrio Sur las enseña cada 150 m o más; Bajo Vías, cada 200; los demás, cada 250)
  for (const l of [city, puro]) {
    const r = de(l, 'rejilla').map(o => o.d);
    assert.ok(r.length > 10, 'rejillas');
    for (let i = 1; i < r.length; i++) {
      const min = C.PERFIL[M.estacionDe(r[i - 1], 'city').distrito].rejilla[0];
      assert.ok(r[i] - r[i - 1] >= min - 1e-9, `una cada ${min} m o más`);
    }
  }
  // el parque trae tramos de burbujas, que ocupan los tres carriles; los otros distritos no
  const burb = de(city, 'burbujas');
  assert.ok(burb.length >= 1, 'hay burbujas');
  for (const b of burb) {
    assert.equal(M.estacionDe(b.d0, 'city').distrito, 'parque', 'solo en el parque');
    if (!b.setos) assert.ok(b.largo >= 70 && b.largo <= 110, 'largo del tramo solo');
  }
  // los contenedores que caen solo son cajones, y solo en los muelles
  const caen = city.filter(o => o.cae);
  assert.ok(caen.length > 0, 'hay contenedores que caen');
  for (const o of caen) { assert.equal(o.tipo, 'cajon'); assert.equal(M.estacionDe(o.d, 'city').distrito, 'muelles'); }
  // nada de lo nuevo choca
  for (const t of ['energia', 'rejilla', 'burbujas']) { assert.ok(M.TIPOS[t], t); assert.equal(M.caja({ tipo: t, d: 10, carril: 0 }, 10), null, t + ' no choca'); }
  // la altura del contenedor: arriba lejos, en el suelo antes de llegar, y bajando sin saltos
  assert.equal(C.alturaCae(40), 9); assert.equal(C.alturaCae(12), 0); assert.equal(C.alturaCae(0), 0);
  let prev = C.alturaCae(34);
  for (let d = 33.5; d >= 12; d -= 0.5) { const h = C.alturaCae(d); assert.ok(h <= prev + 1e-12, 'baja de a poco'); prev = h; }
  // los números que el jugador siente
  assert.equal(C.ENERGIA_LLENA, 10); assert.ok(C.TABLA_SEG > 0 && C.MONEDAS2_SEG > 0);
  assert.ok(C.BURBUJAS.gravedad > 0 && C.BURBUJAS.gravedad < 1, 'en las burbujas se flota');
  assert.ok(C.CHICLE.salto > 1, 'el chicle salta más');
  assert.equal(C.CHICLE.seg, 15); assert.ok(C.CHICLE.rebote > M.ALTO_TECHO && C.CHICLE.tope > M.ALTO_TECHO + 2, 'el rebote del chicle pasa el frente de un vagón');
  // Dante: cada celda vale por dos (en ciudad.js, sin pasarse de la barra)
  assert.match(lee('ciudad.js'), /C\.ventaja\.energia/);
  assert.match(lee('ciudad.js'), /Math\.min\(CITY\.ENERGIA_LLENA/);
});

test('la pista clásica no cambió con City (sus huellas)', () => {
  // las mismas de metrorush-modos.test.cjs: el recorrido de 15 km con un túnel, la mochila y un boleto
  function clasica(semilla) {
    // la pista de la versión 2 (la que rehacen las pruebas guardadas)
    const g = M.crearGenerador(semilla, { version: 2 }), objs = [], curva = M.velocidadDe(undefined, 2); let D = 0, t = 0;
    while (D < 15000) {
      const V = curva.velocidad(t); D += V * 0.05; t += 0.05; objs.push(...g.generarHasta(D + 230, { V }));
      if (Math.abs(D - 1300) < 1 && !g._t) { g._t = 1; g.pedirTunel(D + 40, 'ocaso'); }
      if (Math.abs(D - 2000) < 1 && !g._c) { g._c = 1; objs.push(...g.monedasCielo(D + 12, D + 100, 1)); g.pedirBoleto(2, D + 300); }
    }
    // como en metrorush-modos: de las monedas, solo su id y su carril (lo que lee la prueba del antitrampas)
    const lee = objs.map(o => o.tipo === 'moneda' ? { id: o.id, c: o.carril } : o);
    return crypto.createHash('sha256').update(JSON.stringify(lee)).digest('hex').slice(0, 16) + ':' + objs.length;
  }
  assert.equal(clasica(1), '83dec4198ead80ca:4746');
  assert.equal(clasica(2026), '043d71412da4f3b6:4747');
  assert.equal(clasica(424242), 'ad1c7261c748d071:4681');
});

test('el generador de City nunca deja una carrera imposible (robot con la física del juego, 8 semillas × 2 modos × 11 km)', () => {
  const resumen = [];
  for (const modo of ['city', 'citypuro']) for (let k = 1; k <= 8; k++) {
    const semilla = k * 92821 + (modo === 'city' ? 0 : 7), metros = 11000;
    const { objs, curva } = pista(semilla, metros + 400, modo);
    const P = plan(objs, metros + 300, curva);
    assert.ok(P.bien[1][0], `${modo} ${semilla}: el plan de carriles llega al final`);
    const fps = [20, 30, 60, 144][k % 4];
    const r = robot(objs, modo, metros, { fps, curva, P });
    assert.equal(r.choque, null, `${modo} ${semilla} a ${fps} cuadros/s: ${JSON.stringify(r.choque)}`);
    resumen.push(r);
  }
  // y de verdad pasó por lo de City: pisó (rodando en el aire sobre drones o cayendo de techos), se deslizó y saltó
  assert.ok(resumen.reduce((s, r) => s + r.grind, 0) > 100, 'se deslizó por barandas');
  assert.ok(resumen.reduce((s, r) => s + r.cuenta.saltos, 0) > 200, 'saltó');
  assert.ok(resumen.reduce((s, r) => s + r.cuenta.rodadas, 0) > 100, 'rodó');
  assert.ok(resumen.reduce((s, r) => s + r.setos, 0) > 10, 'saltó setos flotando');
  assert.ok(resumen.reduce((s, r) => s + r.conductos, 0) > 10, 'pasó conductos rodando');
});

/* ---------- cada mecánica, cuadro a cuadro ---------- */

/** Corre en el carril 1 de `desde` a `hasta` a velocidad fija con `objs`,
    haciendo lo que diga `accion(D, r)`; devuelve el choque (o null), la
    altura final y lo que pasó. Misma física que el robot. */
function tramo(objs, { fps = 60, V = 20, desde = 0, hasta = 60, y0 = 0, vy0 = 0, carril = 1, grav = () => 1, accion = () => {} }) {
  const dt = 1 / fps, r = { x: X[carril], carril, y: y0, vy: vy0, enAire: y0 > 0, rodar: 0 }, os = objs.map(o => Object.assign({}, o));
  let D = desde, Dantes = D, lanzado = false, pisado = 0, riel = 0, maxY = y0, minRiel = Infinity;
  const vl = 2.2 / F.cambioCarril;                                 // cambiarse de carril: 2,2 m en 0,17 s (como juego.js)
  while (D < hasta) {
    Dantes = D; D += V * dt;
    accion(D, r);
    r.x += Math.max(-vl * dt, Math.min(vl * dt, X[r.carril] - r.x));
    const yAntes = r.y, sop = M.soporte(os, r.x, D, r.y, Dantes);
    r.vy -= F.gravedad * grav(D) * dt; r.y += r.vy * dt;
    if (r.y <= sop.h) { r.y = sop.h; r.vy = 0; r.enAire = false; } else if (!r.enAire && r.y > sop.h + 0.05) r.enAire = true;
    for (const o of os) if (C.enLona(o, r.x, D, r.y, Dantes, r.vy)) {   // barrido, como en ciudad.js
      o.usada = true; lanzado = true; r.enAire = true;
      r.vy = o.variante === 'vapor' ? M.impulso(Math.max(0.6, C.LONA.altura - r.y)) : C.impulsoLona(1);
    }
    if (sop.apoyo && sop.apoyo.tipo === 'baranda' && !r.enAire) { riel += V * dt; minRiel = Math.min(minRiel, r.y); }
    if (r.rodar > 0) r.rodar -= dt;
    maxY = Math.max(maxY, r.y);
    const yb = r.y + 0.02, yt = r.y + (r.rodar > 0 ? F.altoRodando : F.altoDePie);
    for (const o of os) {
      const k = M.caja(o, D);
      if (!k || k.y1 <= k.y0 || D + M.MEDIO_LARGO < k.z0 || D - M.MEDIO_LARGO > k.z1 || Math.abs(r.x - X[o.carril]) >= k.w + F.medioAncho || yb >= k.y1 || yt <= k.y0) continue;
      if (C.pisa(o, yAntes, r.vy)) { o.roto = true; pisado++; r.vy = M.impulso(1.1); r.enAire = true; continue; }
      return { choque: o.tipo, D, y: r.y, carril: r.carril, lanzado, pisado, riel, maxY, minRiel };
    }
  }
  return { choque: null, D, y: r.y, carril: r.carril, lanzado, pisado, riel, maxY, minRiel };
}
const RITMOS = [20, 30, 60, 144], VELS = [16, 24, 32, 40, 46, 53, 60];   // hasta el tope de City (60 m/s)
/* «De frente choca» se mira desde 60 cuadros/s: a 20 un cuadro avanza
   hasta 2,3 m y un objeto corto (un dron mide 0,9 m; una barrera baja de la
   Línea 3, 0,24) puede quedar entre dos cuadros. Pasa igual en el clásico;
   lo que importa aquí es que lo que se debe pasar se pase a cualquier ritmo. */
const CHOCA = fps => fps >= 60;

test('el cajón: de frente choca, se salta a tiempo, y cayendo encima se rompe', () => {
  const caj = { tipo: 'cajon', carril: 1, d: 40 };
  for (const fps of RITMOS) for (const V of VELS) {
    if (CHOCA(fps)) assert.equal(tramo([caj], { fps, V, desde: 20 }).choque, 'cajon', `${fps}/${V}: de frente choca`);
    const salta = tramo([caj], { fps, V, desde: 20, accion: (D, r) => { if (!r.enAire && 39.4 - D < V * 0.2 && D < 39.4) { r.vy = M.impulso(F.alturaSalto); r.enAire = true; } } });
    assert.equal(salta.choque, null, `${fps}/${V}: saltándolo pasa`);
    const cae = tramo([caj], { fps, V, desde: 40 - V * Math.sqrt(2 * 1.6 / F.gravedad), y0: 2.4 });    // cayendo de 2,4 m (un techo, una lona) justo encima: a 0,8 m en su centro
    assert.equal(cae.choque, null, `${fps}/${V}: cayendo encima no choca`); if (CHOCA(fps)) assert.equal(cae.pisado, 1, `${fps}/${V}: lo pisa`);
  }
  // la regla del pisotón: bajando y con los pies (en el cuadro anterior) casi a la altura de arriba
  assert.equal(C.pisa({ tipo: 'cajon' }, 0.9, -3), true); assert.equal(C.pisa({ tipo: 'cajon' }, 0.3, -3), false);
  assert.equal(C.pisa({ tipo: 'cajon' }, 0.9, 2), false, 'subiendo no pisa'); assert.equal(C.pisa({ tipo: 'tren' }, 9, -3), false);
  assert.equal(C.pisa({ tipo: 'cajon', roto: true }, 2, -3), false);
});

test('el dron: de pie choca, un salto normal también, rodando pasa, y desde arriba se pisa', () => {
  const dron = { tipo: 'dron', carril: 1, d: 40 };
  for (const fps of RITMOS) for (const V of VELS) {
    if (CHOCA(fps)) assert.equal(tramo([dron], { fps, V, desde: 20 }).choque, 'dron', `${fps}/${V}: de pie choca`);
    const rueda = tramo([dron], { fps, V, desde: 20, accion: (D, r) => { if (r.rodar <= 0 && 39.4 - D < V * 0.25 + 0.8 && D < 39.4) r.rodar = F.tiempoRodar; } });
    assert.equal(rueda.choque, null, `${fps}/${V}: rodando pasa`);
    const salta = tramo([dron], { fps, V, desde: 20, accion: (D, r) => { if (!r.enAire && 39.4 - D < V * 0.2 && D < 39.4) { r.vy = M.impulso(F.alturaSalto); r.enAire = true; } } });
    if (CHOCA(fps)) assert.equal(salta.choque, 'dron', `${fps}/${V}: un salto normal no lo pasa`);
  }
  assert.equal(C.pisa({ tipo: 'dron' }, 2.4, -2), true, 'cayendo de un techo lo pisa');
  assert.equal(C.pisa({ tipo: 'dron' }, F.alturaSalto, -0.1), false, 'con un salto normal, ni en lo más alto');
});

test('la baranda: de frente choca; saltando se sube, se desliza todo el riel y se baja sin chocar', () => {
  const b = { tipo: 'baranda', carril: 1, d0: 40, largo: 24, alto: C.BARANDA.alto };
  const v0 = M.impulso(F.alturaSalto), tCae = (v0 + Math.sqrt(v0 * v0 - 2 * F.gravedad * C.BARANDA.alto)) / F.gravedad;   // del salto al riel
  for (const fps of RITMOS) for (const V of VELS) {
    // la más corta que arma el generador a esa velocidad
    const largo = Math.ceil(V * 0.75) + 10, b = { tipo: 'baranda', carril: 1, d0: 40, largo, alto: C.BARANDA.alto };
    const comido = V * tCae - (V * 0.2 + 0.4);                    // lo que el salto se come del comienzo del riel
    assert.equal(tramo([b], { fps, V, desde: 25 }).choque, 'baranda', `${fps}/${V}: de frente choca`);   // (es larga: choca a cualquier ritmo)
    const sube = tramo([b], { fps, V, desde: 25, hasta: 40 + largo + 30, accion: (D, r) => { if (!r.enAire && r.y < 0.5 && 39.7 - D < V * 0.2 + 0.4 && D < 39.7) { r.vy = M.impulso(F.alturaSalto); r.enAire = true; } } });
    assert.equal(sube.choque, null, `${fps}/${V}: saltando se sube`);
    assert.ok(sube.riel > largo - comido - 2 && sube.riel >= 8, `${fps}/${V}: se desliza (${sube.riel.toFixed(1)} m de ${largo})`);   // todo el riel menos lo que se come el salto
    assert.equal(sube.y, 0, `${fps}/${V}: al final se baja`);
  }
  // sostiene solo en su carril y a lo largo del riel
  assert.equal(M.soporte([b], X[1], 50, 0.9).h, 1); assert.equal(M.soporte([b], X[1], 50, 0.3).h, 0);
  assert.equal(M.soporte([b], X[0], 50, 0.9).h, 0); assert.equal(M.soporte([b], X[1], 70, 0.9).h, 0);
  // no queda una franja entre «choca» y «sostiene»
  const k = M.caja(b, 50); assert.ok(C.BARANDA.alto - 0.47 <= k.y1 - 0.02 + 1e-9);
});

test('la lona: te lanza por encima de los vagones, a toda velocidad y ritmo de cuadros, sin chocar', () => {
  for (const fps of RITMOS) for (const V of VELS) for (const n of [C.vagonesLona(V), Math.min(4, C.vagonesLona(V) + 1)]) {
    // como la arma el generador: el tren empieza a huecoLona(V) m de la lona, con vagonesLona(V) vagones (o uno más)
    const d0 = 40 + C.huecoLona(V), objs = [{ tipo: 'lona', carril: 1, d: 40 }];
    for (let i = 0; i < n; i++) objs.push({ tipo: 'tren', carril: 1, d0: d0 + i * (M.LARGO_VAGON + 0.4), largo: M.LARGO_VAGON, vel: 0 });
    const fin = d0 + n * (M.LARGO_VAGON + 0.4);
    const r = tramo(objs, { fps, V, desde: 30, hasta: fin + 30 });
    assert.equal(r.choque, null, `${fps}/${V}/${n} vagones: no choca`);
    assert.ok(r.lanzado, `${fps}/${V}: la lona lanza`);
    assert.ok(r.maxY > (fps >= 60 ? 5 : 4.5) && r.maxY < 5.4, `${fps}/${V}: hasta ~5,2 m (${r.maxY.toFixed(2)})`);   // a 20 cuadros/s el paso de Euler sube un poco menos
    const s = tramo(objs, { fps, V, desde: 30, hasta: fin - 3 }); assert.equal(s.y, M.ALTO_TECHO, `${fps}/${V}/${n}: aterriza en el techo (a cualquier velocidad)`);
  }
  // con Sol (×1,15) sube más, y nunca pasa de los 6 m sobre los que ya nada choca
  assert.ok(C.impulsoLona(1.15) > C.impulsoLona(1)); assert.ok(C.LONA.altura * 1.15 < 6.05);
  assert.equal(C.enLona({ tipo: 'lona', carril: 1, d: 40, usada: true }, X[1], 40, 0), false, 'una vez cada una');
  assert.equal(C.enLona({ tipo: 'lona', carril: 1, d: 40 }, X[1], 40, 1.2), false, 'saltando por encima no');
});

/* ---------- lo propio de cada distrito, cuadro a cuadro ----------
   Cada uno como lo arma el generador a esa velocidad (las mismas cuentas
   de city.js), a 20, 30, 60 y 144 cuadros/s y de 16 a 46 m/s. */
const salto = r => { r.vy = M.impulso(F.alturaSalto); r.enAire = true; };
const vagones = (c, d0, n) => Array.from({ length: n }, (_, i) => ({ tipo: 'tren', carril: c, d0: d0 + i * (M.LARGO_VAGON + 0.4), largo: M.LARGO_VAGON, vel: 0 }));

test('el cobertizo (Barrio Sur): de frente choca; un salto al techito y otro al vagón te dejan arriba', () => {
  for (const fps of RITMOS) for (const V of VELS) {
    const largo = Math.ceil(V * 0.8) + 4, cob = { tipo: 'cobertizo', carril: 1, d0: 40, largo, alto: C.COBERTIZO.alto };
    const nv = C.vagonesCobertizo(V), objs = [cob, ...vagones(1, 40 + largo, nv)], fin = 40 + largo + nv * (M.LARGO_VAGON + 0.4);   // los vagones que pone el generador a esa velocidad
    if (CHOCA(fps)) assert.equal(tramo(objs, { fps, V, desde: 20 }).choque, 'cobertizo', `${fps}/${V}: de frente choca`);
    // el primer salto, ~0,3 s antes (el salto pasa 1,55 m a los 0,2 s); el segundo, desde el techito, ~0,25 s antes del vagón
    const accion = (D, r) => {
      if (!r.enAire && r.y < 0.5 && 40 - D < V * 0.3 && D < 40) salta(r);
      else if (!r.enAire && Math.abs(r.y - C.COBERTIZO.alto) < 0.05 && 40 + largo - D < V * 0.25) salta(r);
    }, salta = salto;
    const r = tramo(objs, { fps, V, desde: 20, hasta: fin - 3, accion });
    assert.equal(r.choque, null, `${fps}/${V}: no choca`);
    assert.equal(r.y, M.ALTO_TECHO, `${fps}/${V}: termina sobre el vagón`);
    // quedarse en el techito sin el segundo salto es chocar con el vagón
    if (CHOCA(fps)) assert.equal(tramo(objs, { fps, V, desde: 20, hasta: fin, accion: (D, r) => { if (!r.enAire && r.y < 0.5 && 40 - D < V * 0.3 && D < 40) salta(r); } }).choque, 'tren', `${fps}/${V}: sin el segundo salto, el vagón`);
  }
  // los vagones del cobertizo crecen solo pasado el tope viejo de City (46 m/s): las pistas de la versión 2 no cambian
  assert.equal(C.vagonesCobertizo(46), 2); assert.equal(C.vagonesCobertizo(60), 3);
  // el techito sostiene solo desde arriba y en su carril
  const cob = { tipo: 'cobertizo', carril: 1, d0: 40, largo: 20 };
  assert.equal(M.soporte([cob], X[1], 50, 1.6).h, C.COBERTIZO.alto); assert.equal(M.soporte([cob], X[1], 50, 1).h, 0); assert.equal(M.soporte([cob], X[0], 50, 2.1).h, 0);
});

test('la viga de grúa (Los Muelles): se salta al comienzo, sube sola hasta 4,2 m y te suelta sobre los vagones', () => {
  for (const fps of RITMOS) for (const V of VELS) {
    const sube = Math.ceil(V * 0.35) + 4, largo = sube + Math.ceil(V * 1.2), w0 = 40 + sube + 2;
    const n = Math.ceil((40 + largo + V * 0.3 + 6 - w0) / (M.LARGO_VAGON + 0.4));
    const objs = [{ tipo: 'viga', carril: 1, d0: 40, sube, largo }, ...vagones(1, w0, n)], fin = w0 + n * (M.LARGO_VAGON + 0.4);
    if (CHOCA(fps)) assert.equal(tramo(objs, { fps, V, desde: 20, hasta: fin }).choque, 'tren', `${fps}/${V}: sin subir, los vagones`);
    let arriba = 0;
    const r = tramo(objs, { fps, V, desde: 20, hasta: fin - 3, accion: (D, r) => {
      if (!r.enAire && r.y < 0.5 && 40 - D < V * 0.35 && D < 40) salto(r);   // ~0,35 s antes (el arco de monedas lo marca)
      if (!r.enAire && r.y > 4) arriba++;
    } });
    assert.equal(r.choque, null, `${fps}/${V}: no choca`);
    assert.ok(arriba > 0, `${fps}/${V}: llegó arriba de la viga`);
    assert.equal(r.y, M.ALTO_TECHO, `${fps}/${V}: la viga lo suelta sobre los vagones`);
  }
  // la altura de la viga, a lo largo
  const v = { tipo: 'viga', carril: 1, d0: 40, sube: 10, largo: 40 };
  assert.equal(C.alturaViga(v, 40), C.VIGA.y0); assert.equal(C.alturaViga(v, 50), C.VIGA.y1); assert.equal(C.alturaViga(v, 70), C.VIGA.y1);
  assert.equal(M.soporte([v], X[1], 45, 0.2).h, 0, 'desde el suelo no se agarra'); assert.equal(M.soporte([v], X[0], 60, 4.2).h, 0, 'solo en su carril');
});

test('los rieles en zigzag (Bulevar Aurora): se cruzan los tres carriles sin tocar el suelo', () => {
  for (const fps of RITMOS) for (const V of VELS) {
    const solape = Math.ceil(V * 0.35) + 4, rieles = [];
    let d0 = 40, fin = 40;
    [0, 1, 2].forEach((k, i) => {
      const largo = i === 0 ? Math.ceil(V * 0.75) + 10 : Math.ceil(V * 0.9) + 10;
      if (i > 0) d0 = fin - solape;
      rieles.push({ tipo: 'baranda', carril: k, d0, largo, alto: C.BARANDA.alto, zigzag: i + 1 }); fin = d0 + largo;
    });
    const r = tramo(rieles, { fps, V, desde: 20, hasta: fin - 2, carril: 0, accion: (D, r) => {
      if (!r.enAire && r.y < 0.5 && 39.7 - D < V * 0.2 + 0.4 && D < 39.7) salto(r);
      // a mitad del solape, al riel siguiente (cambiarse tarda 0,17 s; el solape dura ~0,35)
      for (let i = 1; i < 3; i++) if (r.carril === i - 1 && r.y >= 0.9 && !r.enAire && D > rieles[i].d0 + 1) r.carril = i;
    } });
    assert.equal(r.choque, null, `${fps}/${V}: no choca`);
    assert.equal(r.carril, 2, `${fps}/${V}: llegó al tercer riel`);
    assert.ok(r.minRiel >= C.BARANDA.alto - 1e-9, `${fps}/${V}: no tocó el suelo (${r.minRiel})`);
    assert.ok(r.riel > rieles[1].largo + rieles[2].largo - 2 * solape, `${fps}/${V}: se deslizó por los tres (${r.riel.toFixed(1)} m)`);
  }
});

test('el conducto (Bajo Vías): una rodada no alcanza; volver a rodar en el anillo, sí', () => {
  for (const fps of RITMOS) for (const V of VELS) {
    const largo = Math.ceil(V * 0.85) + 2, anillo = 40 + Math.round((largo - 0.1 * V - 0.3) / 2), con = { tipo: 'conducto', carril: 1, d0: 40, largo, anillo };   // como lo arma city.js
    if (CHOCA(fps)) assert.equal(tramo([con], { fps, V, desde: 20 }).choque, 'conducto', `${fps}/${V}: de pie choca`);
    const una = tramo([con], { fps, V, desde: 20, hasta: 40 + largo + 5, accion: (D, r) => { if (r.rodar <= 0 && D < 40 && 40 - D < V * 0.1 + 0.6) r.rodar = F.tiempoRodar; } });
    if (CHOCA(fps)) assert.equal(una.choque, 'conducto', `${fps}/${V}: una sola rodada no alcanza`);
    const dos = tramo([con], { fps, V, desde: 20, hasta: 40 + largo + 5, accion: (D, r) => {
      if (r.rodar <= 0 && D < 40 && 40 - D < V * 0.1 + 0.6) r.rodar = F.tiempoRodar;
      else if (D >= anillo && D < anillo + V / fps + 0.01) r.rodar = F.tiempoRodar;   // en el anillo, «abajo» otra vez
    } });
    assert.equal(dos.choque, null, `${fps}/${V}: rodando otra vez en el anillo pasa`);
  }
  // por arriba se camina (sostiene a 3,35 m) y rodando bajo él no se choca
  const con = { tipo: 'conducto', carril: 1, d0: 40, largo: 30 };
  assert.equal(M.soporte([con], X[1], 50, 3.3).h, C.CONDUCTO.alto); assert.ok(F.altoRodando < C.CONDUCTO.y0, 'rodando cabe debajo');
});

test('los setos (Parque): de un salto normal no se pasan; con el salto que flota de las burbujas, sí', () => {
  const g = C.BURBUJAS.gravedad;
  for (const fps of RITMOS) for (const V of VELS) {
    const seto = { tipo: 'seto', carril: 1, d: 60 };
    const accion = (D, r) => { if (!r.enAire && 60 - D < V * 0.5 && D < 60) salto(r); };
    if (CHOCA(fps)) assert.equal(tramo([seto], { fps, V, desde: 20, hasta: 80, accion }).choque, 'seto', `${fps}/${V}: sin burbujas choca`);
    const r = tramo([seto], { fps, V, desde: 20, hasta: 60 + V * 1.3, accion, grav: () => g });
    assert.equal(r.choque, null, `${fps}/${V}: flotando pasa`);
    assert.ok(r.maxY > C.SETO.alto, `${fps}/${V}: le pasa por encima`);
  }
  assert.ok(M.impulso(F.alturaSalto) ** 2 / (2 * F.gravedad) < C.SETO.alto - 0.5, 'un salto normal ni se le acerca');
});

test('cada distrito trae lo suyo, y solo el suyo', () => {
  const propio = { cobertizo: 'sur', viga: 'muelles', conducto: 'bajo', seto: 'parque' };
  for (const modo of ['city', 'citypuro']) for (const semilla of [11, 2026, 90210]) {
    const objs = pista(semilla, 10500, modo).objs, cuenta = {};
    for (const o of objs) {
      const d = M.estacionDe(o.d ?? o.d0, modo).distrito;
      if (propio[o.tipo]) { assert.equal(d, propio[o.tipo], `${modo} ${semilla}: ${o.tipo} fuera de su distrito (${d})`); cuenta[o.tipo] = (cuenta[o.tipo] || 0) + 1; }
      if (o.zigzag === 1) { assert.equal(d, 'bulevar', `${modo} ${semilla}: zigzag fuera del Bulevar`); cuenta.zigzag = (cuenta.zigzag || 0) + 1; }
      if (o.tipo === 'burbujas') assert.ok(o.setos >= 2, `${modo} ${semilla}: burbujas sin setos`);
    }
    // a menudo: varias veces por distrito (Bajo Vías empieza a los 9 km: hasta 10,5 hay 1,5)
    for (const [t, min] of [['cobertizo', 3], ['viga', 4], ['zigzag', 5], ['conducto', 3], ['seto', 12]]) assert.ok((cuenta[t] || 0) >= min, `${modo} ${semilla}: pocos ${t} (${cuenta[t] || 0})`);
  }
  assert.deepEqual(C.PROPIO, { sur: 'cobertizo', muelles: 'viga', bulevar: 'zigzag', bajo: 'conducto' });
});

/* La mezcla de cada distrito: qué hay en su pista (sin monedas ni regalos),
   en fracción. Una fila de vagones seguidos cuenta una vez (si no, los
   trenes taparían todo) y los trenes que vienen de frente van aparte. */
function mezclaDistritos(objs, modo) {
  const cuenta = {}, fin = [-99, -99, -99];
  const cosas = ['tren', 'cajon', 'dron', 'baranda', 'lona', 'cobertizo', 'viga', 'conducto', 'seto', 'bajo', 'alto', 'rampa'];
  for (const o of objs.filter(o => cosas.includes(o.tipo)).sort((a, b) => (a.d ?? a.d0) - (b.d ?? b.d0))) {
    let t = o.tipo;
    if (t === 'tren' && o.vel > 0) t = 'frente';
    else if (t === 'tren') { const sigue = Math.abs(fin[o.carril] - o.d0) < 1; fin[o.carril] = o.d0 + o.largo + 0.4; if (sigue) continue; }
    const d = M.estacionDe(o.d ?? o.d0, modo).distrito;
    (cuenta[d] ||= {})[t] = (cuenta[d][t] || 0) + 1;
  }
  const r = {};
  for (const [d, c] of Object.entries(cuenta)) { const tot = Object.values(c).reduce((a, b) => a + b, 0); r[d] = {}; for (const [t, n] of Object.entries(c)) r[d][t] = n / tot; }
  return r;
}

test('cada distrito se arma con su propia pista: sin filas clásicas, y ninguno se parece a otro', () => {
  for (const modo of ['city', 'citypuro']) for (const semilla of [11, 2026, 90210]) {
    const m = mezclaDistritos(pista(semilla, 13500, modo).objs, modo), q = `${modo} ${semilla}`;
    const f = (d, ...ts) => ts.reduce((a, t) => a + (m[d][t] || 0), 0);
    // ni una barrera baja, ni una alta, ni una rampa de la Línea 3: City arma toda su pista
    for (const d of Object.keys(m)) for (const t of ['bajo', 'alto', 'rampa']) assert.equal(m[d][t] || 0, 0, `${q}: ${t} en ${d}`);
    assert.deepEqual(Object.keys(m).sort(), ['bajo', 'bulevar', 'muelles', 'parque', 'sur'], `${q}: los cinco distritos`);
    // lo que define a cada uno (medido: ver CLAUDE.md, con margen)
    assert.ok(f('sur', 'cobertizo') >= 0.05, `${q}: el Barrio Sur sube por cobertizos (${f('sur', 'cobertizo').toFixed(2)})`);
    assert.ok(f('muelles', 'cajon', 'viga') >= 0.5, `${q}: Los Muelles son cajones que caen y grúas (${f('muelles', 'cajon', 'viga').toFixed(2)})`);
    assert.ok(f('bulevar', 'baranda') >= 0.28, `${q}: el Bulevar es de rieles (${f('bulevar', 'baranda').toFixed(2)})`);
    assert.ok(f('parque', 'seto') >= 0.4, `${q}: el Parque es de setos (${f('parque', 'seto').toFixed(2)})`);
    assert.ok(f('bajo', 'dron', 'conducto') >= 0.3, `${q}: Bajo Vías se rueda (${f('bajo', 'dron', 'conducto').toFixed(2)})`);
    for (const d of ['bulevar', 'bajo']) assert.ok(f(d, 'frente') >= 0.06, `${q}: en ${d} vienen trenes de frente`);
    assert.ok(f('sur', 'frente') < f('bulevar', 'frente'), `${q}: el Barrio Sur (el primero) tiene menos trenes de frente que el Bulevar`);
    // y ningún par de distritos tiene la misma mezcla (distancia L1 entre sus fracciones)
    const ds = Object.keys(m);
    for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
      const ts = new Set([...Object.keys(m[ds[i]]), ...Object.keys(m[ds[j]])]);
      let l1 = 0; for (const t of ts) l1 += Math.abs((m[ds[i]][t] || 0) - (m[ds[j]][t] || 0));
      assert.ok(l1 >= 0.45, `${q}: ${ds[i]} y ${ds[j]} se parecen demasiado (${l1.toFixed(2)})`);
    }
  }
  // cada distrito tiene su perfil, y uno no es la copia de otro
  assert.deepEqual(Object.keys(C.PERFIL).sort(), ['bajo', 'bulevar', 'muelles', 'parque', 'sur']);
  const firmas = Object.values(C.PERFIL).map(p => JSON.stringify(p.camino));
  assert.equal(new Set(firmas).size, firmas.length, 'cada distrito pone cosas distintas en su camino');
});

/* ---------- el antitrampas ---------- */

/* Una carrera de City como la anota juego.js: los pedidos (túneles y
   postales), cada estrella (las secretas incluidas) donde de verdad está,
   una muestra cada 2 s y el choque al final. */
function carrera(modo, semilla, segundos) {
  const curva = M.velocidadDe(modo), g = M.crearGenerador(semilla, { modo }), pr = MP.nueva({ s: semilla, b: 3, md: 0, u: 'uid-city', m: modo });
  let D = 0, t = 0, rr = 0, estrellas = 0, puntos = 0, secretas = 0, actual = M.estacionDe(0, modo), cambio = null, tunel = null, sig = MP.PASO_MUESTRA;
  const objs = new Map(), tomadas = new Set();
  const agrega = l => { for (const o of l) { if (o.tipo === 'estrella') objs.set(o.id, o); if (o.tipo === 'tunel' && cambio && !tunel) tunel = o; } };
  const anota = (cod, x) => MP.evento(pr, cod, t, D, rr, x), pedido = (tipo, ...d) => MP.pedido(pr, tipo, g.estado().dSig, ...d);
  agrega(g.generarHasta(230, { V: curva.velocidad(0) }));
  pedido('B', actual.boleto, 420); g.pedirBoleto(actual.boleto, 420);
  while (t < segundos) {
    const dt = 1 / 60; t += dt; rr += dt * 1000;
    const V = curva.velocidad(t), dD = V * dt; D += dD;
    puntos += M.puntosPorTramo(dD, M.multiplicador({ base: 3, estrellas, doble: false, extra: 0, fijo: M.modoDe(modo).multFijo }));
    agrega(g.generarHasta(D + 230, { V: Math.max(13, V) }));
    const um = M.siguienteUmbral(D, modo), e = M.estacionDe(um - D < 220 ? um : D, modo);
    if (!cambio && e.clave !== actual.clave) { cambio = e; pedido('T', D + 40, e.id); g.pedirTunel(D + 40, e.id); }
    if (cambio && tunel && D >= tunel.d0 + 40) { actual = cambio; if (actual.boleto) { const d = tunel.d0 + tunel.largo + 260; pedido('B', actual.boleto, d); g.pedirBoleto(actual.boleto, d); } cambio = null; tunel = null; }
    for (const o of objs.values()) if (!tomadas.has(o.id) && Math.abs(o.d - D) < 0.9) { tomadas.add(o.id); anota('e', o.id); estrellas = Math.min(M.MAX_ESTRELLAS, estrellas + 1); if (o.secreta) secretas++; }
    if (t >= sig) { anota('w'); sig = t + MP.PASO_MUESTRA; }
  }
  anota('m'); anota('f');
  return { prueba: MP.cierra(pr, { sn: 0 }), puntos: Math.floor(puntos), metros: Math.floor(D), secretas };
}

test('la prueba de City se rehace: estrellas secretas, túneles, postales y la curva de City', () => {
  for (const modo of ['city', 'citypuro']) {
    const r = carrera(modo, 55555, 200);
    assert.ok(r.secretas >= 2, modo + ': tomó estrellas secretas (' + r.secretas + ')');
    assert.ok(r.prueba.i.some(q => q[0] === 'T') && r.prueba.i.some(q => q[0] === 'B'), modo + ': pidió túneles y postales');
    const re = MP.rehace(r.prueba);
    assert.equal(re.motivo, undefined, modo + ': ' + re.motivo);
    assert.equal(re.modo, modo); assert.ok(Math.abs(re.puntos - r.puntos) <= 1, `${modo}: ${re.puntos} / ${r.puntos}`); assert.equal(re.metros, r.metros);
    // una estrella secreta movida de lugar (que no está donde se dice) se rechaza
    const p = JSON.parse(JSON.stringify(r.prueba)), i = p.e.findIndex(e => e[0] === 'e');
    p.e[i][2] += 300; assert.ok(MP.rehace(p).motivo, modo + ': una estrella fuera de lugar se rechaza');
    // la misma carrera leída con la curva clásica no cuadra (los metros y el reloj delatan)
    const q = JSON.parse(JSON.stringify(r.prueba)); delete q.m; assert.ok(MP.rehace(q).motivo, modo + ': con la curva clásica no cuadra');
  }
});

/* ---------- el juego ---------- */

test('el juego engancha City en pocos lugares, y todo lo que choca o se recoge se ve', () => {
  const juego = lee('juego.js'), ciudad = lee('ciudad.js'), mundo = lee('mundo.js'), dibujo = lee('mundo-city.js'), html = lee('index.html');
  // el chicle no entra en la lista de poderes (el marcador le pediría su duración a la tienda)
  assert.match(ciudad, /c\.ciudad\.chicle = CITY\.CHICLE\.seg/); assert.doesNotMatch(ciudad, /c\.poderes\.chicle/);
  // los ganchos de juego.js (pocos, marcados CITY)
  for (const re of [/ciudad\.pisa\(c, o, mundo\)/, /ciudad\.salva\(c, mundo\)/, /ciudad\.poder\(c, clase, mundo\)/, /ciudad\.fisica\(c, sop, dt, mundo, tiempoTotal\)/,
    /ciudad\.faltaPostal\(c, progreso, cb\.estacion\.boleto\)/, /ciudad\.libreta\(modoSel, progreso, \$, fmt\)/, /ciudad\.idsTienda\(modoSel\)/, /Object\.assign\(MOTIVOS, ciudad\.MOTIVOS\)/])
    assert.match(juego, re);
  // los objetos de City se dibujan (con el «!» de lo que se esquiva o se recoge)
  for (const f of ['cajonCity', 'dronCity', 'barandaCity', 'lonaCity', 'vaporCity', 'estrellaSecreta', 'chicle']) assert.match(dibujo, new RegExp(`\\n  ${f}\\(\\) \\{`), f);
  for (const f of ['cobertizoCity', 'vigaCity', 'conductoCity', 'setoCity']) assert.match(dibujo, new RegExp(`\\n  ${f}\\(\\) \\{`), f);
  // todo tipo que City registra en el motor (choca o sostiene) tiene su dibujo
  for (const t of ['cajon', 'dron', 'baranda', 'lona', 'rejilla', 'burbujas', 'cobertizo', 'viga', 'conducto', 'seto']) { assert.ok(M.TIPOS[t], t); assert.match(dibujo, new RegExp(`o\\.tipo === '${t}'`), t + ': se dibuja'); }
  const obj = dibujo.slice(dibujo.indexOf('\n  cajonCity() {'), dibujo.indexOf('\n  pasosCity(pre) {'));
  for (const m of obj.matchAll(/'((?:pintura|plano|luz|metal|personaje|tex:[\w|]+|texluz:[\w|]+))(!?)'/g)) assert.equal(m[2], '!', 'material de juego sin «!»: ' + m[1]);
  assert.match(mundo, /export const GANCHOS/); assert.match(mundo, /GANCHOS\.objeto \? GANCHOS\.objeto\(kit, o\)/);
  // se cargan antes (el motor con City, y los módulos del dibujo y de la carrera)
  assert.ok(html.indexOf('city.js?v=') < html.indexOf('motor.js?v='), 'city.js antes de motor.js');
  assert.match(juego, /import '\.\/mundo-city\.js\?v=metrorush-\d+'/); assert.match(juego, /from '\.\/ciudad\.js\?v=metrorush-\d+'/);
});

/* ---------- El chicle, cuadro a cuadro ----------
   Como el Bubble Gum de City: rodar en el aire es un PISOTÓN (baja de golpe,
   abre rejillas, pisa cajones y drones) y al caer la burbuja rebota alto;
   volando atrae monedas. Antes ese rodar subía 2,6 m en el aire (un doble
   salto, que no era lo de City). Se corre ciudad.js de verdad con la física
   de juego.js copiada en corto (como el robot). */
function correChicle({ fps, V, objs = [], seg = 2, chicle = true, init, pulsa }) {
  const fuente = lee('ciudad.js').replace('export function crearCiudad', 'function crearCiudad');
  const crearCiudad = new Function(fuente + '\nreturn crearCiudad;')();
  const boings = [], mundo = { chispa() {}, suelta() {}, city: { chicle() {}, rompe() {}, geiser() {}, boing(x, y) { boings.push(y); } } };
  const ciudad = crearCiudad({ M, sonido: { nota() {}, soplo() {} }, aviso() {} });
  const c = { r: { carril: 1, x: 0, xPrev: 0, y: 0, vy: 0, enAire: false, rodar: 0, rodarPend: false, saltoBufer: -1, ultSuelo: 0 },
    poderes: { iman: 0, mochila: 0, zapatillas: 0, doble: 0, patineta: 0 }, activos: objs, D: 0, Dantes: 0, t: 0, V, monedas: 0,
    cuenta: { monedas: 0, saltos: 0, rodadas: 0, poderes: 0 }, invulnerable: 0, modo: M.MODOS.city };
  ciudad.inicia(c, { personajeCity: null, personajesCity: [] }, mundo);
  if (chicle) ciudad.poder(c, 'chicle', mundo);
  if (init) init(c);
  const dt = 1 / fps, r = c.r, log = [];
  let muerto = null;
  for (let k = 0; k < seg * fps && !muerto; k++) {
    c.t += dt; c.Dantes = c.D; c.yAntes = r.y; c.D += V * dt;
    const p = pulsa(c);                                          // lo que pide el jugador viendo el cuadro anterior (se aplica después de antes, como en juego.js)
    ciudad.antes(c);
    if (p === 'arriba') r.saltoBufer = 0.16;
    else if (p === 'abajo' && r.enAire && !ciudad.rebota(c)) { r.vy = -F.caidaRapida; r.rodarPend = true; r.saltoBufer = -1; }
    if (r.saltoBufer > 0) {
      r.saltoBufer -= dt;
      if (!r.enAire || c.t - r.ultSuelo < 0.09) { r.vy = M.impulso(F.alturaSalto * ciudad.salto(c)); r.enAire = true; r.saltoBufer = -1; r.ultSuelo = -1; }
    }
    r.xPrev = r.x;
    const sop = M.soporte(c.activos, r.x, c.D, r.y, c.Dantes);
    r.vy -= F.gravedad * ciudad.gravedad(c) * dt; r.y += r.vy * dt;
    if (r.y <= sop.h) { if (r.enAire && r.vy < -1 && r.rodarPend) r.rodar = F.tiempoRodar; r.y = sop.h; r.vy = 0; r.enAire = false; r.rodarPend = false; r.ultSuelo = c.t; }
    else if (!r.enAire && r.y > sop.h + 0.05) r.enAire = true;
    ciudad.fisica(c, sop, dt, mundo, c.t);
    if (r.rodar > 0) r.rodar -= dt;
    const alto = r.rodar > 0 ? F.altoRodando : F.altoDePie;     // los choques (el barrido entre cuadros, como en juego.js)
    for (const o of c.activos) {
      const q = M.caja(o, c.D); if (!q || q.y1 <= q.y0) continue;
      let ys = r.y; const dD = c.D - c.Dantes;
      if (c.D + M.MEDIO_LARGO < q.z0 || c.D - M.MEDIO_LARGO > q.z1) {
        if (q.z1 - q.z0 + 2 * M.MEDIO_LARGO >= dD || c.Dantes - M.MEDIO_LARGO > q.z1 || c.D + M.MEDIO_LARGO < q.z0) continue;
        const s0 = Math.max(0, (q.z0 - M.MEDIO_LARGO - c.Dantes) / dD), s1 = Math.min(1, (q.z1 + M.MEDIO_LARGO - c.Dantes) / dD);
        ys = c.yAntes + (r.y - c.yAntes) * (s0 + s1) / 2;
      }
      if (Math.abs(r.x - X[o.carril]) >= q.w + F.medioAncho || ys + 0.02 >= q.y1 || ys + alto <= q.y0) continue;
      if (ciudad.pisa(c, o, mundo) || c.invulnerable > 0) continue;
      muerto = o; break;
    }
    log.push({ y: r.y, enAire: r.enAire, iman: ciudad.imanChicle(c) });
  }
  return { c, log, muerto, boings };
}
/** Salta y, en lo alto, rueda (el pisotón). `luego(c)` sigue después de caer. */
const saltaYPisa = luego => { let f = 0; return c => { if (f === 0) { f = 1; return 'arriba'; } if (f === 1 && c.r.enAire && c.r.vy <= 0) { f = 2; return 'abajo'; } if (f === 2 && !c.r.enAire) { f = 3; if (luego) luego(c); } return null; }; };

test('el chicle: rodar en el aire es un pisotón y al caer la burbuja rebota alto (a todo ritmo de cuadros)', () => {
  const ideal = C.CHICLE.rebote;
  for (const fps of [20, 30, 60, 144]) {
    // 1) el rebote: sube lo de CHICLE.rebote (lo que el semi-implícito de juego.js da a ese ritmo, como el salto) y nunca antes de caer
    const { log, boings } = correChicle({ fps, V: 30, seg: 3, pulsa: saltaYPisa() });
    const cae = log.findIndex((e, k) => k && !e.enAire && log[k - 1].enAire);
    assert.ok(cae > 0, fps + ': cae del pisotón');
    assert.ok(log.slice(0, cae).every(e => e.y < F.alturaSalto * C.CHICLE.salto + 0.01), fps + ': el pisotón no sube en el aire (no es un doble salto)');
    const sube = Math.max(...log.slice(cae).map(e => e.y));
    // (el Euler semi-implícito pierde v0·dt/2 de altura, como en cualquier salto: a 20 fps 3,27 m, a 144 fps 3,55)
    assert.ok(sube > ideal - M.impulso(ideal) / fps / 2 - 0.05 && sube <= ideal + 0.01, `${fps} fps: rebota ${sube.toFixed(2)} m (ideal ${ideal})`);
    assert.ok(sube > M.ALTO_TECHO - 0.5, fps + ': el rebote alcanza un techo de vagón');
    assert.equal(boings.length, 1, fps + ': un ¡boing! en el dibujo');
    // volando atrae monedas; en el suelo, no
    assert.ok(log.some(e => e.enAire && e.iman) && !log.some(e => !e.enAire && e.iman), fps + ': el imán del chicle, solo en el aire');
    // 2) sin chicle, rodar en el aire es el de siempre: cae y no rebota
    const s = correChicle({ fps, V: 30, seg: 2, chicle: false, pulsa: saltaYPisa() });
    const i = s.log.findIndex((e, k) => k && !e.enAire && s.log[k - 1].enAire);
    assert.equal(Math.max(...s.log.slice(i).map(e => e.y)), 0, fps + ': sin chicle no rebota');
    for (const V of [16, 30, 46, 60]) {
      // 3) del suelo al techo: un vagón que aparece delante justo al rebotar se sube sin chocar
      const tren = { tipo: 'tren', carril: 1, d0: 1e9, largo: 30, vel: 0, id: 1 };
      const t = correChicle({ fps, V, objs: [tren], seg: 3, pulsa: saltaYPisa(c => { tren.d0 = c.D + V * 0.45; }) });
      assert.equal(t.muerto, null, `${fps} fps, ${V} m/s: no choca con el vagón`);
      assert.ok(t.log.some(e => !e.enAire && e.y === M.ALTO_TECHO), `${fps} fps, ${V} m/s: cae sobre el techo`);
      // 4) la rejilla: el pisotón con chicle la abre aunque rebote (cae sobre ella, o unos metros antes)
      for (const antes of [0, 5]) {
        const rej = { tipo: 'rejilla', carril: 1, d: 1e9 };
        correChicle({ fps, V, objs: [rej], seg: 2, pulsa: saltaYPisa(c => { rej.d = c.D + antes; }) });
        assert.ok(rej.abierta, `${fps} fps, ${V} m/s: abre la rejilla ${antes} m delante`);
      }
      // 5) el pisotón sobre un dron (bajando de un techo) lo pisa y la burbuja rebota hasta el tope; sin chicle, el dron lanza lo suyo
      let pisado = 0;
      for (let k = 0; k <= 10; k++) {
        const ventana = [true, false].map(chicle => {
          const dron = { tipo: 'dron', carril: 1, d: V * (0.02 + k * 0.006) };
          let f = 0;
          const d = correChicle({ fps, V, objs: [dron], seg: 1.5, chicle, init: c => { c.r.y = M.ALTO_TECHO; c.r.enAire = true; }, pulsa: () => (f++ === 0 ? 'abajo' : null) });
          return { roto: !!dron.roto && !d.muerto, sube: Math.max(...d.log.map(e => e.y)), monedas: d.c.monedas };
        });
        assert.equal(ventana[0].roto, ventana[1].roto, `${fps} fps, ${V} m/s: el chicle pisa el dron igual que el pisotón de siempre`);
        if (ventana[0].roto) { pisado++; assert.equal(ventana[0].monedas, 16, 'pisotón: el doble'); assert.ok(ventana[0].sube > ventana[1].sube && ventana[0].sube <= C.CHICLE.tope + 0.01, 'rebota más, sin pasar el tope'); }
      }
      assert.ok(pisado >= 4, `${fps} fps, ${V} m/s: hay ventana para pisar el dron (${pisado})`);
    }
  }
  // 6) un cajón delante del pisotón: se pisa (el rebote va un cuadro después, cuando los pies ya bajaron). Donde el
  //    pisotón de siempre lo pisa, con chicle no se choca nunca (salta más alto: a veces lo pasa por arriba o lo pisa más lejos)
  for (const fps of [20, 30, 60, 144]) for (const V of [16, 30, 46, 60]) {
    let pisa = 0;
    for (let k = 0; k <= 12; k++) {
      const [conChicle, normal] = [true, false].map(chicle => {
        const caj = { tipo: 'cajon', carril: 1, d: 1e9 }; let f = 0;
        const r = correChicle({ fps, V, objs: [caj], seg: 2, chicle, pulsa: c => {
          if (f === 0) { f = 1; return 'arriba'; }
          if (f === 1 && c.r.enAire && c.r.vy <= 0) { f = 2; caj.d = c.D + V * (0.03 + 0.01 * k); return 'abajo'; }
          return null; } });
        return r.muerto ? 'choca' : caj.roto ? 'pisa' : 'pasa';
      });
      if (conChicle === 'pisa') pisa++;
      if (normal === 'pisa') assert.notEqual(conChicle, 'choca', `${fps} fps, ${V} m/s, ${k}: el chicle no choca donde el pisotón de siempre pisa`);
    }
    assert.ok(pisa >= 2, `${fps} fps, ${V} m/s: hay ventana para pisar el cajón con chicle (${pisa})`);
  }
});
