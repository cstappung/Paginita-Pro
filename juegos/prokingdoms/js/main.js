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
    if (sub) sub.textContent = 'Conectando con el servidor…';

    // En línea: el servidor asigna tu casilla y conoce a tus vecinos. Sin servidor: modo local.
    // ?local juega sin conectarse al servidor (pruebas, demos)
    const net = /[?&](local|timelapse)\b/.test(location.search) ? null : await PK.Net.connect(local);
    let save = local;
    if (net) {
      const cloud = net.cloud && net.cloud.v === PK.D.SAVE_V ? net.cloud : null; // partidas de versiones viejas no sirven
      if (cloud && (!local || (cloud.lastSeen || 0) > (local.lastSeen || 0))) save = cloud;
      if (save && (Number.isInteger(save.slot) ? save.slot : 0) !== net.slot) save = null; // partida de otra casilla: empieza de nuevo
      PK.D.setupRealms(net.slot, net.humans);
    } else PK.D.setupRealms(local && Number.isInteger(local.slot) ? local.slot : 0, null);
    if (sub) sub.textContent = 'Generando el mundo…';
    await new Promise(r => setTimeout(r, 20));

    PK.Game.init(save);
    PK.Render.init(document.getElementById('game'));
    PK.UI.init();
    PK.Input.init(document.getElementById('game'));
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
    if (report) PK.UI.offlineReport(report);
    else if (!save) PK.UI.toast((net ? 'Bienvenido a ' + PK.Net.world.name + '. ' : 'Bienvenido a tu reino. ') + 'Todo lo demás está en la niebla: abre el Libro de Misiones (B) para empezar.', 'epic');
    if (TIMELAPSE) {
      // el time-lapse maneja su propio reloj: no corre el bucle normal ni se guarda nada
      PK.Game.noSave = true;
      const sc = document.createElement('script');
      sc.src = 'tools/timelapse.js';
      document.body.appendChild(sc);
      return;
    }
    PK.Net.start();

    let last = performance.now(), lastWall = Date.now();
    function frame(now) {
      const wall = Date.now(), gap = (wall - lastWall) / 1000;
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
      PK.Render.draw(dt);
      PK.UI.update(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    setInterval(() => PK.Game.save(), 20000);
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
