/* PRODROP · el walkout de fútbol: la mejor carta del sobre sale como en el
   FUT. Un pasillo, la salida a la cancha y, de a uno, la bandera, la
   posición y el escudo del club; después la carta.

   La escena 3D (three.js) vive en `walkout3d.js`, que se empaqueta desde
   colabtex/src/prodrop/walkout3d.js y se importa recién al abrir un sobre
   de fútbol (`precarga`). Sin WebGL, con «reducir movimiento» o si el
   import falla, el pasillo es 2D (CSS) y lo demás es igual.

   `WALKOUT.jugar(o)` devuelve una promesa que se cumple al terminar o al
   saltarlo (solo con el botón «Saltar»). o = { nivel: 'completo' | 'corto', color, color2, rareza,
   bandera: {img, nombre}, posicion, club: {img, nombre} | null, cinta,
   carta: elemento de la carta ya armada, sonido(nombre) }. */
(function () {
  const V = (document.currentScript && document.currentScript.src.match(/\?v=([^&]+)/) || [])[1] || '';
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let modulo = null, cargando = null;
  const hayWebGL = (() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  })();
  function precarga() {
    if (REDUCED || !hayWebGL) return Promise.resolve(null);
    if (!cargando) cargando = import('./walkout3d.js' + (V ? '?v=' + V : '')).then(m => (modulo = m)).catch(() => null);
    return cargando;
  }
  // el color del pasillo y del estadio hasta la carta: el mismo para toda rareza, para no adelantar nada
  const NEUTRO = '#bcd4ff';
  const espera = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

  // los tiempos (segundos) de cada paso
  function guion(nivel, o) {
    const corto = nivel === 'corto';
    const tunel = corto ? 1.1 : 3.0;
    const pasos = [];
    let t = tunel + (corto ? .6 : .9);
    const dur = corto ? .95 : 1.25;
    pasos.push({ k: 'bandera', t }); t += dur;
    if (!corto || !o.club) { pasos.push({ k: 'posicion', t }); t += corto ? .8 : 1.0; }
    if (o.club) { pasos.push({ k: 'club', t }); t += dur; }
    else if (!corto) { pasos.push({ k: 'leyenda', t }); t += dur; }
    return { tunel, desde: corto ? -27 : 0, pasos, carta: t, fin: t + (corto ? 2.2 : 3.0) };
  }

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  async function jugar(o) {
    const g = guion(o.nivel, o);
    const m = await espera(precarga(), 1800);
    const raiz = el('div', 'wo' + (o.nivel === 'corto' ? ' corto' : ''));
    raiz.style.setProperty('--wc', o.color || '#ffd23d');
    raiz.style.setProperty('--wc2', o.color2 || '#ffffff');
    raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-label', 'Revelando tu mejor carta');
    const cv = el('canvas', 'wo-cv');
    const dosD = el('div', 'wo-2d', '<div class="wo-pasillo">' + '<i></i>'.repeat(9) + '</div><div class="wo-estadio"></div>');
    const flash = el('div', 'wo-flash');
    const pista = el('div', 'wo-pista');
    const capa = el('div', 'wo-capa');
    const paso = {
      bandera: el('div', 'wo-paso wo-bandera', `<img src="${esc(o.bandera.img)}" alt=""><b translate="no">${esc(o.bandera.nombre)}</b>`),
      posicion: el('div', 'wo-paso wo-posicion', `<b>${esc(o.posicion)}</b><small>POSICIÓN</small>`),
      club: o.club ? el('div', 'wo-paso wo-club', `<img src="${esc(o.club.img)}" alt=""><b translate="no">${esc(o.club.nombre)}</b>`) : null,
      leyenda: el('div', 'wo-paso wo-leyenda', '<b>♛</b><small>LEYENDA</small>'),
    };
    const cartaBox = el('div', 'wo-carta');
    const rz = el('div', 'wo-rareza', esc(o.rareza || ''));
    if (o.carta) cartaBox.appendChild(o.carta);
    if (o.cinta) cartaBox.appendChild(el('div', 'wo-cinta', esc(o.cinta)));
    const saltar = el('button', 'wo-saltar', 'Saltar ›'); saltar.type = 'button';
    Object.values(paso).forEach(p => p && capa.appendChild(p));
    capa.append(rz, cartaBox);
    raiz.append(m ? cv : dosD, flash, pista, capa, saltar);
    document.body.appendChild(raiz);

    let escena = null;
    if (m) {
      try {
        escena = m.crear(cv, { color: NEUTRO, color2: '#ffffff', tunel: g.tunel, desde: g.desde });
        const ajusta = () => escena && escena.tamano(innerWidth, innerHeight);
        ajusta(); addEventListener('resize', ajusta); raiz._ajusta = ajusta;
      } catch { escena = null; cv.replaceWith(dosD); }
    }
    if (!escena) { raiz.classList.add('es-2d'); dosD.style.setProperty('--tunel', g.tunel + 's'); }

    return new Promise(resolve => {
      let t0 = performance.now(), raf = 0, hecho = false, salio = false, mostrada = false, fuegos = false;
      const vistos = new Set();
      const s = n => { try { o.sonido && o.sonido(n); } catch {} };
      s('tunel');
      // la pista: al primer paso, medio segundo, una línea del color de la carta abajo
      setTimeout(() => { if (!hecho) pista.classList.add('on'); }, 450);
      const termina = () => {
        if (hecho) return; hecho = true;
        cancelAnimationFrame(raf);
        raiz.classList.add('sale');
        setTimeout(() => {
          if (raiz._ajusta) removeEventListener('resize', raiz._ajusta);
          if (escena) escena.fin();
          raiz.remove();
        }, 380);
        removeEventListener('keydown', tecla, true);
        resolve();
      };
      /* Solo el botón «Saltar» adelanta (antes de la carta, salta a la carta;
         con la carta ya, termina). Los toques en cualquier otro lado y las
         teclas se tragan: por costumbre se toca muchas veces al abrir y se
         saltaba sin querer. */
      const adelanta = () => {
        const t = (performance.now() - t0) / 1000;
        if (t < g.carta) t0 = performance.now() - g.carta * 1000;
        else termina();
      };
      const tecla = e => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); } };
      addEventListener('keydown', tecla, true);
      raiz.addEventListener('pointerdown', e => { if (e.target !== saltar) e.preventDefault(); });
      saltar.addEventListener('click', e => { e.stopPropagation(); adelanta(); });
      const cuadro = ahora => {
        if (hecho) return;
        const t = (ahora - t0) / 1000;
        if (escena) escena.cuadro(t);
        if (!salio && t >= g.tunel) {
          salio = true; raiz.classList.add('afuera'); s('salida');
          flash.animate([{ opacity: 0 }, { opacity: .95, offset: .25 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' });
        }
        for (const p of g.pasos) {
          const nodo = paso[p.k]; if (!nodo) continue;
          const on = t >= p.t && t < g.carta && !g.pasos.some(q => q.t > p.t && t >= q.t);
          if (on && !vistos.has(p.k)) { vistos.add(p.k); s('paso'); }
          nodo.classList.toggle('on', on);
        }
        if (!mostrada && t >= g.carta) {
          mostrada = true; raiz.classList.add('carta'); s('carta');
          flash.animate([{ opacity: 0 }, { opacity: .8, offset: .2 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' });
          if (escena && !fuegos) { fuegos = true; if (escena.tinta) escena.tinta(o.color); escena.fuegos(12); }
        }
        if (t >= g.fin) return termina();
        raf = requestAnimationFrame(cuadro);
      };
      raf = requestAnimationFrame(cuadro);
    });
  }

  window.WALKOUT = { jugar, precarga };
})();
