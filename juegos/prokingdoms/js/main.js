// Arranque y bucle principal. Si la pestaña estuvo en segundo plano, el tiempo perdido se simula por tasas.
(function () {
  'use strict';
  const PK = window.PK;
  PK.dev = /[?&]dev\b/.test(location.search);
  const TIMELAPSE = /[?&]timelapse\b/.test(location.search);

  async function boot() {
    PK.Sprites.init();
    const local = TIMELAPSE ? null : PK.Game.loadSave(); // el time-lapse siempre parte de cero
    const sub = document.querySelector('.ld-sub');
    const viaje = PK.Mar ? PK.Mar.viaje() : null; // Fase 9: esta carga viene de una travesía en el Galeón
    if (sub) sub.textContent = viaje ? (viaje === 'mar' ? 'Navegando hacia el Archipiélago de Bruma…' : 'Volviendo a tu reino…') : 'Conectando con el servidor…';

    // En línea: el servidor asigna tu casilla y conoce a tus vecinos. Sin servidor: modo local.
    // ?local juega sin conectarse al servidor (pruebas, demos)
    const net = /[?&](local|timelapse)\b/.test(location.search) ? null : await PK.Net.connect(local);
    let save = local;
    if (net) {
      const cloud = net.cloud && net.cloud.v === PK.D.SAVE_V ? net.cloud : null; // partidas de versiones viejas no sirven
      // `at` es cuándo se guardó; lastSeen es la última vez que se jugó ese mundo (con dos mundos, ya no es lo mismo)
      const cuando = o => o.at || o.lastSeen || 0;
      if (cloud && (!local || cuando(cloud) > cuando(local))) save = cloud;
      if (save && (Number.isInteger(save.slot) ? save.slot : 0) !== net.slot) save = null; // partida de otra casilla: empieza de nuevo
      PK.D.setupRealms(net.slot, net.humans);
    } else PK.D.setupRealms(local && Number.isInteger(local.slot) ? local.slot : 0, null);
    if (sub && !viaje) sub.textContent = 'Generando el mundo…';
    await new Promise(r => setTimeout(r, 20));

    PK.Game.init(save);
    PK.Render.init(document.getElementById('game'));
    PK.UI.init();
    PK.Input.init(document.getElementById('game'));
    if (PK.Mar) PK.Mar.iniciar(viaje);
    if (PK.Musica) PK.Musica.iniciar();
    const tc = PK.Game.buildings.find(b => b.owner === 'p' && b.type === 'tc');
    if (tc) PK.Render.centerOn(tc.cx + 2, tc.cy - 2);

    // primero el estado real de las zonas comunes, después lo que pasó mientras no estabas
    if (net) await PK.Net.sync(true);
    let report = null;
    if (save) {
      const away = (Date.now() - (save.lastSeen || Date.now())) / 1000;
      if (away > 60) report = PK.Game.simulateOffline(away);
    }
    document.getElementById('loading').remove();
    // una partida (local o en la nube) de otra SAVE_V: el mundo se reinició con la actualización
    const viejo = !save && (PK.Game.reinicioDe !== undefined || (net && net.cloud && net.cloud.v !== PK.D.SAVE_V));
    if (viejo && PK.UI.reinicio) PK.UI.reinicio();
    if (report) PK.UI.offlineReport(report);
    else if (!save) PK.UI.toast((net ? 'Bienvenido a ' + PK.Net.world.name + '. ' : 'Bienvenido a tu reino. ') + 'Todo lo demás está en la niebla: abre el Libro de Misiones (B) para empezar.', 'epic');
    if (TIMELAPSE) {
      // el time-lapse es el piloto automático (tools/piloto.js, T2 del plan) a ×40, sin guardar nada. El viejo
      // tools/timelapse.js no vino con el juego (B6). Si el piloto no carga, se avisa y se juega normal.
      PK.Game.noSave = true;
      piloto({ escala: 40, timelapse: true });
      return;
    }
    PK.Net.start();
    loop();
    // ?dev&piloto[=N]: el piloto de pruebas juega solo a ×N (10 si no se dice)
    const pm = PK.dev && /[?&]piloto(?:=(\d+))?/.exec(location.search);
    if (pm) piloto({ escala: +pm[1] || 10 }, true);
  }
  function piloto(o, yaCorre) {
    const sc = document.createElement('script');
    sc.src = 'tools/piloto.js';
    sc.onload = () => { PK.Piloto.start(o); if (!yaCorre) loop(); };
    sc.onerror = () => { PK.UI.toast('El piloto de pruebas (tools/piloto.js) no está incluido.', 'warn'); if (!yaCorre) loop(); };
    document.body.appendChild(sc);
  }

  function loop() {
    // el piloto adelanta Date.now() a la velocidad del juego (tools/piloto.js); el hueco de pestaña se mide con el reloj real
    const reloj = () => (PK.relojReal ? PK.relojReal() : Date.now());
    let last = performance.now(), lastWall = reloj();
    function frame(now) {
      const wall = reloj(), gap = (wall - lastWall) / 1000;
      lastWall = wall;
      if (gap > 3) {
        const rep = PK.Game.simulateOffline(gap, gap < 300);
        if (rep) PK.UI.offlineReport(rep);
        last = now;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const steps = PK.Game.timeScale;
      for (let i = 0; i < steps; i++) PK.Game.update(dt);
      PK.Input.update(dt);
      if (!(PK.Batalla && PK.Batalla.abierta())) PK.Render.draw(dt); // con la batalla a pantalla completa, el mapa no se ve
      PK.UI.update(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    setInterval(() => { if (!PK.Game.noSave) PK.Game.save(); }, 20000);
    const saveNow = () => { if (!PK.Game.noSave) { PK.Game.save(); PK.Net.saveCloud(true); } };
    window.addEventListener('beforeunload', saveNow);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  }

  window.addEventListener('load', () => setTimeout(() => boot().catch(e => {
    console.error(e);
    const sub = document.querySelector('.ld-sub');
    if (sub) sub.textContent = 'Error al iniciar: ' + e.message;
  }), 30));
})();
