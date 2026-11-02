/* Pro Kingdoms dentro de Juegos: el puente con la página.

   Va después de i18n/mando/volumen y ANTES de los scripts del juego, porque
   `js/social.js` lee `window.ProKingdomsPlatform` al cargarse.

   Lo que decide (ver CLAUDE.md de esta carpeta):
   - **Modo local, sin servidor.** El cartero (colabtex/src/juegos/prokingdoms.js)
     abre la página con `?local`, así que el juego no busca `/api/join` (en
     GitHub Pages sería un 404 por cada carga) y los demás reinos, el mercado
     y el gremio se simulan en el navegador.
   - **Una partida por cuenta.** `?perfil=<uid>` hace que el juego le ponga el
     sufijo a sus claves de `localStorage` (U.key). Las dos que el juego no
     sufija (`pk_site_coins`, `pk_player_name`) las sufija este archivo.
   - **Las monedas son del reino, no del sitio.** Durante la beta, lo que el
     juego llama «monedas» vive solo en este navegador y no toca la economía
     de Juegos (monedas.js): el navegador las suma y nadie las valida. Para
     conectarlas a las monedas reales hace falta el servidor (CLAUDE.md).
   - El nombre que ven los reinos vecinos simulados es el de la cuenta
     (`?nombre=`).

   Nunca toca Firebase. Al padre solo le dice `listo` y `volver`. */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const perfil = String(q.get('perfil') || '').replace(/[^\w-]/g, '').slice(0, 20);
  const nombre = String(q.get('nombre') || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24) || 'Tú';
  const clave = k => (perfil ? k + '_' + perfil : k);
  const lee = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const K_MONEDAS = clave('pk_site_coins');

  window.ProKingdomsPlatform = {
    name: 'paginita-pro-beta',
    getPlayer() { return { id: perfil || 'local', name: nombre }; },
    getCoins() { return Math.max(0, Math.floor(+(lee(K_MONEDAS) || 0)) || 0); },
    addCoins(n, reason) {
      const v = Math.max(0, this.getCoins() + Math.round(+n || 0));
      guarda(K_MONEDAS, String(v));
      window.dispatchEvent(new CustomEvent('pk:coins', { detail: { coins: v, delta: n, reason } }));
      return v;
    },
    spendCoins(n, reason) {
      n = Math.round(+n || 0);
      if (n <= 0 || this.getCoins() < n) return false;
      this.addCoins(-n, reason);
      return true;
    },
    reportStat() { /* sin logros ni clasificación durante la beta */ }
  };

  /* Dentro de Juegos: «← Juegos» y el volumen común (volumen.js), en la
     barra de arriba del juego, que la arma ui.js al terminar de cargar. */
  const enMarco = window.parent && window.parent !== window;
  const avisa = tipo => { if (enMarco) window.parent.postMessage({ canal: 'prokingdoms-child', tipo }, location.origin); };
  function montaBarra() {
    const barra = document.getElementById('topbar');
    if (!barra) return false;
    if (barra.querySelector('.pk-sitio')) return true;
    const caja = document.createElement('div');
    caja.className = 'pk-sitio';
    if (enMarco) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pk-sitio-volver'; b.textContent = '← Juegos'; b.title = 'Volver a Juegos';
      b.addEventListener('click', e => { e.stopPropagation(); try { window.PK && PK.Game && PK.Game.save(); } catch (er) { /* sin partida */ } avisa('volver'); });
      caja.appendChild(b);
    }
    const vol = document.createElement('span');
    vol.setAttribute('data-volumen', '');
    caja.appendChild(vol);
    const beta = document.createElement('span');
    beta.className = 'pk-sitio-beta'; beta.textContent = 'BETA';
    beta.title = 'Beta cerrada: la partida y las monedas del reino se guardan en este navegador';
    caja.appendChild(beta);
    barra.prepend(caja);   // al principio: en el celular la barra se desliza y el final queda fuera
    if (window.VolumenJuego) window.VolumenJuego.control(vol);
    return true;
  }
  window.addEventListener('load', () => {
    avisa('listo');
    let n = 0;
    const t = setInterval(() => { if (montaBarra() || ++n > 600) clearInterval(t); }, 100);
  });
})();
