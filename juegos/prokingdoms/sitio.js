/* Pro Kingdoms dentro de Juegos: el puente con la página.

   Va después de i18n/mando/volumen y ANTES de los scripts del juego, porque
   `js/social.js` lee `window.ProKingdomsPlatform` al cargarse.

   Lo que decide (ver CLAUDE.md de esta carpeta):
   - **En línea o local lo decide el cartero** (colabtex/src/juegos/prokingdoms.js),
     según juegos/prokingdoms/servidor.json. Con servidor abre la página con
     `?api=<url de la Cloud Function>`: el juego le pide todo a esa URL y, para
     entrar, el token de Firebase de la sesión, que este archivo le pide al
     padre (`getAuthToken`) porque el marco nunca toca Firebase. Sin servidor
     abre con `?local` (el juego no busca `/api/join`, que en GitHub Pages sería
     un 404) y los demás reinos, el mercado y el gremio se simulan. Si el
     servidor no contesta o no lo deja entrar, el juego sigue en local solo.
   - **Una partida por cuenta.** `?perfil=<uid>` hace que el juego le ponga el
     sufijo a sus claves de `localStorage` (U.key). Las dos que el juego no
     sufija (`pk_site_coins`, `pk_player_name`) las sufija este archivo.
   - **Las monedas son del reino, no del sitio.** Lo que el
     juego llama «monedas» vive solo en este navegador y no toca la economía
     de Juegos (monedas.js): el navegador las suma y nadie las valida. Para
     conectarlas a las monedas reales hace falta el servidor (CLAUDE.md).
   - El nombre que ven los reinos vecinos simulados es el de la cuenta
     (`?nombre=`).

   Nunca toca Firebase. Al padre le dice `listo`, `volver` y `reportes` (abrir la ventana de errores y
   sugerencias, que pinta la página), y le pide `token` y `pkPase` (comprar el pase). */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const perfil = String(q.get('perfil') || '').replace(/[^\w-]/g, '').slice(0, 20);
  const nombre = String(q.get('nombre') || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24) || 'Tú';
  const clave = k => (perfil ? k + '_' + perfil : k);
  const lee = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const K_MONEDAS = clave('pk_site_coins');
  // Solo una URL https (o localhost para el emulador): nada que el juego vaya a llamar con el token de la cuenta sin querer.
  const api = String(q.get('api') || '');
  const apiBase = /^https:\/\/[\w.-]+(\/[\w./-]*)?$/.test(api) || /^http:\/\/(localhost|127\.0\.0\.1):\d+(\/[\w./-]*)?$/.test(api) ? api : '';
  const enMarco0 = window.parent && window.parent !== window;
  /* El token de Firebase de la sesión (vence a la hora): se le pide al padre cada vez que el juego entra. */
  let pedido = 0;
  function getAuthToken() {
    if (!enMarco0) return Promise.resolve(null);
    const id = ++pedido;
    return new Promise(res => {
      const fin = tok => { window.removeEventListener('message', oye); clearTimeout(reloj); res(tok); };
      const oye = e => { const x = e.data; if (e.source === window.parent && e.origin === location.origin && x && x.canal === 'prokingdoms-parent' && x.tipo === 'token' && x.id === id) fin(typeof x.token === 'string' ? x.token : null); };
      const reloj = setTimeout(() => fin(null), 8000);
      window.addEventListener('message', oye);
      window.parent.postMessage({ canal: 'prokingdoms-child', tipo: 'token', id }, location.origin);
    });
  }

  /* Pase del Reino (Fase 8): el juego pide comprar y la página de Juegos lo confirma con su propia ventana y
     su saldo real, escribe la compra (pkPase/<uid>/<período>) y contesta. El marco nunca gasta monedas de la
     página: solo pide. Resuelve true si se compró, false si no (cancelado, sin saldo, sin página). */
  let pedidoPase = 0;
  function comprarPase(periodo) {
    if (!enMarco0) return Promise.resolve(false);
    const id = ++pedidoPase;
    return new Promise(res => {
      const fin = ok => { window.removeEventListener('message', oye); res(!!ok); };
      const oye = e => { const x = e.data; if (e.source === window.parent && e.origin === location.origin && x && x.canal === 'prokingdoms-parent' && x.tipo === 'pkPaseOk' && x.id === id) fin(x.ok); };
      window.addEventListener('message', oye);
      window.parent.postMessage({ canal: 'prokingdoms-child', tipo: 'pkPase', id, periodo }, location.origin);
    });
  }

  window.ProKingdomsPlatform = {
    name: 'paginita-pro',
    apiBase,
    getAuthToken: apiBase ? getAuthToken : undefined,
    comprarPase: apiBase ? comprarPase : undefined,
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
    reportStat() { /* sin logros ni clasificación del sitio, por ahora */ }
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
    /* Errores y sugerencias: la ventana la pinta la página de Juegos (el marco no toca Firebase). */
    if (enMarco) {
      const r = document.createElement('button');
      r.type = 'button'; r.className = 'pk-sitio-volver pk-sitio-reportes'; r.textContent = '🐞 Reportes';
      r.title = 'Reportar un error o sugerir una mejora, y ver lo que reportaron los demás';
      r.addEventListener('click', e => { e.stopPropagation(); avisa('reportes'); });
      caja.appendChild(r);
    }
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
