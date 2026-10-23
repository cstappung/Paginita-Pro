/* El cierre de los retos diarios del club (Sopa, Sudoku, Electrodle,
   Integrodle): cuánto falta para el próximo, que sale a medianoche de
   Chile como el `diaChile` de cada motor, y compartir el resultado con el
   enlace al juego, que es lo que trae gente nueva y hace volver mañana.
   Sin Firebase ni nada que guardar. En el celular abre la hoja de compartir
   (WhatsApp, Instagram…); en el PC copia el texto. */
(() => {
  const ZONA = 'America/Santiago';
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  /* Segundos que faltan para la medianoche de Chile. */
  function faltan(ahora = new Date()) {
    const p = Object.fromEntries(fmt.formatToParts(ahora).filter(x => x.type !== 'literal').map(x => [x.type, +x.value]));
    return Math.max(0, 86400 - ((p.hour % 24) * 3600 + p.minute * 60 + p.second));
  }
  const dos = n => String(n).padStart(2, '0');
  const reloj = s => `${dos(Math.floor(s / 3600))}:${dos(Math.floor(s / 60) % 60)}:${dos(s % 60)}`;
  /* El enlace al juego dentro de Juegos (no a la página suelta del marco). */
  const enlace = juego => location.origin + '/juegos.html#solo/' + juego;

  const relojes = new Set();
  let timer = 0;
  function late() {
    const s = faltan();
    for (const el of relojes) {
      if (!el.isConnected) { relojes.delete(el); continue; }
      el.textContent = s > 0 ? reloj(s) : '¡ya salió! Recarga';
    }
    if (!relojes.size) { clearInterval(timer); timer = 0; }
  }
  /* Pone en marcha una cuenta regresiva en `el` (se apaga sola cuando el
     elemento sale de la página). */
  function cuenta(el) {
    if (!el) return;
    relojes.add(el); late();
    if (!timer) timer = setInterval(late, 1000);
  }
  async function comparte(texto, juego, boton) {
    const t = texto + '\n' + enlace(juego);
    const tactil = matchMedia('(pointer:coarse)').matches;
    if (navigator.share && tactil) {
      try { await navigator.share({ text: t }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const ok = () => {
      if (!boton) return;
      const antes = boton.textContent;
      boton.textContent = '¡Copiado! ✓';
      setTimeout(() => { if (boton.isConnected) boton.textContent = antes; }, 1800);
    };
    try { await navigator.clipboard.writeText(t); ok(); } catch (e) { prompt('Copia tu resultado:', t); }
  }
  /* El bloque entero, al final de `contenedor`: «Compartir resultado» y
     «Nueva sopa en hh:mm:ss» (`prox`, con su género). `clase` es la del
     botón principal del juego. */
  function cierre(contenedor, { texto, juego, prox = 'Nuevo reto en', clase = 'boton primario' }) {
    if (!contenedor) return;
    const d = document.createElement('div');
    d.className = 'diario-cierre';
    d.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 14px;margin-top:12px';
    d.innerHTML = `<button type="button" class="${clase}">📣 Compartir resultado</button><span>${prox} <b translate="no">--:--:--</b></span>`;
    const b = d.querySelector('button');
    b.onclick = () => comparte(texto, juego, b);
    contenedor.appendChild(d);
    cuenta(d.querySelector('b'));
  }
  window.DiarioClub = Object.freeze({ faltan, reloj, enlace, cuenta, comparte, cierre });
})();
