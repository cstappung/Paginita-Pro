// Avisos: cuando el juego queda en segundo plano, programa un aviso del navegador para cada obra, era,
// investigación o expedición que va a terminar, y para el cofre diario. Si tu página define
// ProKingdomsPlatform.scheduleNotifications(lista), se le pasa la lista para que mande avisos push reales
// (con la pestaña cerrada), y notify(título, texto) reemplaza al aviso del navegador.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D;
  const N = (PK.Notify = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  let timers = [];

  N.supported = () => 'Notification' in window;
  N.enabled = () => U.store.get('pk_notify') === '1' && (!N.supported() || Notification.permission === 'granted' || !!PK.Platform.notify);
  N.enable = async function (on) {
    if (!on) { U.store.set('pk_notify', '0'); return false; }
    if (!PK.Platform.notify && N.supported() && Notification.permission !== 'granted') {
      const r = await Notification.requestPermission();
      if (r !== 'granted') { PK.UI.toast('El navegador no dio permiso para avisos.', 'warn'); return false; }
    }
    U.store.set('pk_notify', '1');
    PK.UI.toast('Te avisaremos cuando terminen tus obras.', 'good');
    return true;
  };
  N.send = function (title, body) {
    if (PK.Platform.notify) { PK.Platform.notify(title, body); return; }
    if (!N.supported() || Notification.permission !== 'granted') return;
    try { new Notification(title, { body, icon: PK.Sprites.icon('chest'), tag: 'pk-' + title }); } catch (e) { void e; }
  };
  // Algo que pasó ahora (te atacan, resultado de una batalla): con la pestaña a la vista basta el toast; si
  // estás en otra pestaña y los avisos están activos, llega un aviso (o el notify de tu página).
  N.now = function (title, body) {
    if (N.enabled() && document.hidden) N.send(title, body);
  };

  // Lo que va a terminar, en segundos desde ahora.
  N.upcoming = function () {
    const st = S(), g = G(), out = [];
    if (!st) return out;
    for (const b of g.buildings) if (b.owner === 'p' && b.upg) out.push({ in: b.upg.total - b.upg.t, title: b.def.name + ' nivel ' + (b.lvl + 1), body: 'Terminó la mejora. Un Maestro de Obras quedó libre.' });
    if (st.eraProg) out.push({ in: st.eraProg.total - st.eraProg.t, title: '¡Era ' + U.roman(st.eraProg.to) + '!', body: 'Tu pueblo avanzó de era: hay edificios y mejoras nuevas.' });
    if (st.research) out.push({ in: (st.research.total - st.research.t) / g.researchMult(), title: D.TECHS[st.research.id].name + ' ' + U.roman(st.research.lvl), body: 'La investigación terminó.' });
    for (const r of (st.exp && st.exp.runs) || []) out.push({ in: ((r.phase === 'go' ? r.arrive + r.travel * 1000 : r.back) - Date.now()) / 1000, title: 'Tus tropas volvieron', body: 'La expedición regresó con su botín.' });
    // campañas: las tuyas llegan a la parcela y los ataques de otros jugadores llegan a tu frontera
    for (const c of (st.terr && st.terr.camps) || []) if (c.phase === 'go') out.push({ in: (c.arrive - Date.now()) / 1000, title: 'Tus tropas llegan a la parcela', body: 'La batalla se resuelve ahora: entra a ver el resumen.' });
    for (const r of (PK.Net && PK.Net.incoming) || []) out.push({ in: (r.arrive - Date.now()) / 1000, title: '¡Llega el ataque de ' + r.from + '!', body: 'Sus tropas llegan a tu frontera ahora. Entra a ver si resististe.' });
    if (st.streak.last === U.dayKey()) { const t = new Date(); t.setHours(24, 0, 30, 0); out.push({ in: (t - Date.now()) / 1000, day: true, title: 'Cofre diario listo', body: 'Abre el cofre para no perder tu racha de ' + st.streak.n + ' días.' }); }
    // "ya casi": a la hora del aviso, si sigue faltando poco para la racha o las diarias (máximo 1 al día)
    const q = PK.Quests, at = new Date();
    at.setHours(D.ALMOST_HOUR, 0, 0, 0);
    if (q && q.almostDue() && at > Date.now() && q.almost()) out.push({ in: (at - Date.now()) / 1000, day: true, title: 'Ya casi', body: q.almost(), check: () => { const t = q.almostDue() && q.almost(); if (t) q.almostSent(); return t; } });
    return out.filter(o => o.in > 5 && o.in < 7 * 86400).sort((a, b) => a.in - b.in);
  };

  function schedule() {
    clear();
    const list = N.upcoming();
    if (PK.Platform.scheduleNotifications) PK.Platform.scheduleNotifications(list.map(o => ({ at: Date.now() + o.in * 1000, title: o.title, body: o.body })));
    if (!N.enabled()) return;
    // los navegadores solo garantizan temporizadores de ~24 días; además juntamos los que caen casi juntos
    let last = -1e9;
    for (const o of list.slice(0, 20)) {
      if (o.in - last < 20) continue;
      last = o.in;
      timers.push(setTimeout(() => {
        if (!o.check) { N.send(o.title, o.body); return; }
        const body = o.check(); // se revisa de nuevo al sonar: quizá ya lo cumpliste
        if (body) N.send(o.title, body);
      }, o.in * 1000));
    }
  }
  function clear() { for (const t of timers) clearTimeout(t); timers = []; }

  // Al irte tras una sesión corta: "vuelve en X min" con lo próximo que termina, en el título de la pestaña
  // y, si los avisos están activos, también como aviso (una vez por sesión).
  const SHORT_SESSION = 10 * 60;
  let shownAt = Date.now(), awayTimer = null, baseTitle = document.title, awaySent = false;
  const nextUp = () => N.upcoming().find(o => !o.day && o.in < 6 * 3600);
  const comeBack = s => (s < 3600 ? Math.max(1, Math.ceil(s / 60)) + ' min' : U.fmtTime(s));
  function awayTitle() {
    const n = S() && nextUp();
    document.title = n ? 'Vuelve en ' + comeBack(n.in) + ' · ' + n.title : baseTitle;
  }
  function onLeave() {
    if (!S() || awayTimer) return;
    const short = (Date.now() - shownAt) / 1000 < SHORT_SESSION, n = nextUp();
    if (!short || !n) return;
    awayTitle();
    awayTimer = setInterval(awayTitle, 15000);
    if (!awaySent && N.enabled() && n.in > 60) { awaySent = true; N.send('Vuelve en ' + comeBack(n.in), 'Lo próximo: ' + n.title + '. Tu reino te espera.'); }
  }
  function onBack() {
    shownAt = Date.now(); awaySent = false;
    if (awayTimer) { clearInterval(awayTimer); awayTimer = null; }
    document.title = baseTitle;
  }
  N.leaving = onLeave;
  document.addEventListener('visibilitychange', () => { if (document.hidden) { schedule(); onLeave(); } else { clear(); onBack(); } });
  window.addEventListener('pagehide', () => { if (PK.Platform.scheduleNotifications) schedule(); onLeave(); });

  // La primera obra que tarda más de un minuto es buen momento para ofrecer los avisos.
  N.suggest = function (sec) {
    if (sec <= 60 || N.enabled() || U.store.get('pk_notify_asked') || (!N.supported() && !PK.Platform.notify)) return;
    U.store.set('pk_notify_asked', '1');
    PK.UI.toast('Esta obra tarda ' + U.fmtTime(sec) + '. ¿Te avisamos cuando termine, aunque estés en otra pestaña?', 'info',
      { label: 'Activar avisos', fn: () => N.enable(true) });
  };
})();
