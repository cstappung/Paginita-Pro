/* Volumen y silencio comunes a los juegos que viven en su propio documento
   (los del Club, Yemas, PRODROP). Cada uno arma su audio a su manera —
   unos con un `master`, otros conectando cada nota a `ctx.destination` —,
   así que el control no puede pedirles nada: se mete por debajo.

   - Todo `AudioContext` creado después de cargar este archivo trae como
     `destination` un nodo de ganancia propio, conectado al destino real.
     Lo que el juego conecte «al parlante» pasa por él, y él aplica el
     volumen y el silencio. Por eso este script va **antes** que los del
     juego: un contexto creado antes no se entera.
   - `<audio>`/`<video>`: el `volume` que escribe el juego se guarda como
     base y el elemento suena a base × volumen.

   El control (🔊 + deslizador) se dibuja en cada `[data-volumen]` de la
   página, o donde lo pida `VolumenJuego.control(el)`. Se guarda en
   `localStorage` (`jg.club.volumen`, 0–100, y `jg.club.mudo`), compartido
   por todos estos juegos, y un cambio en una pestaña llega a las demás. */
(() => {
  if (window.VolumenJuego) return;
  const K_VOL = 'jg.club.volumen', K_MUDO = 'jg.club.mudo';
  const lee = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (_) { return d; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (_) {} };
  const acota = v => Math.max(0, Math.min(100, Math.round(Number(v)) || 0));
  let vol = acota(lee(K_VOL, 80)), mudo = lee(K_MUDO, '0') === '1';
  const factor = () => mudo ? 0 : Math.pow(vol / 100, 1.6); // el oído no es lineal
  const masters = new Set(), medios = new Set(), vistos = new WeakSet(), controles = new Set();
  const anota = el => { if (window.WeakRef && !vistos.has(el)) { vistos.add(el); medios.add(new WeakRef(el)); } };

  const Base = window.AudioContext || window.webkitAudioContext;
  if (Base) {
    const real = Object.getOwnPropertyDescriptor(Base.prototype, 'destination') ||
      (window.BaseAudioContext && Object.getOwnPropertyDescriptor(window.BaseAudioContext.prototype, 'destination'));
    class ConVolumen extends Base {
      constructor(...args) {
        super(...args);
        try {
          const destino = real ? real.get.call(this) : super.destination;
          const g = Base.prototype.createGain.call(this);
          g.gain.value = factor(); g.connect(destino);
          // Lo que lee el juego de `destination` (canales, maxChannelCount) sigue siendo cierto.
          for (const p of ['maxChannelCount', 'numberOfInputs']) if (!(p in g)) Object.defineProperty(g, p, { get: () => destino[p] });
          Object.defineProperty(this, 'destination', { configurable: true, get: () => g });
          masters.add({ ctx: this, g });
        } catch (_) { /* si algo falla, el juego suena igual que antes */ }
      }
    }
    try { window.AudioContext = ConVolumen; if (window.webkitAudioContext) window.webkitAudioContext = ConVolumen; } catch (_) {}
  }

  const M = window.HTMLMediaElement && HTMLMediaElement.prototype;
  const dVol = M && Object.getOwnPropertyDescriptor(M, 'volume');
  if (dVol && dVol.set) {
    const base = new WeakMap();
    const aplica = el => { try { dVol.set.call(el, Math.max(0, Math.min(1, (base.has(el) ? base.get(el) : 1) * factor()))); } catch (_) {} };
    Object.defineProperty(M, 'volume', {
      configurable: true,
      get() { return base.has(this) ? base.get(this) : dVol.get.call(this); },
      set(v) { base.set(this, Number(v)); anota(this); aplica(this); }
    });
    const play = M.play;
    M.play = function () { anota(this); aplica(this); return play.apply(this, arguments); };
    medios.aplica = aplica;
  }
  if (!window.WeakRef) medios.aplica = null;

  function aplica() {
    const f = factor();
    for (const { ctx, g } of masters) { try { g.gain.setTargetAtTime(f, ctx.currentTime, 0.03); } catch (_) { try { g.gain.value = f; } catch (e) {} } }
    if (medios.aplica) for (const r of medios) { const el = r.deref(); if (el) medios.aplica(el); else medios.delete(r); }
    for (const c of controles) c.pinta();
  }

  /* El dibujo: un botón que silencia y un deslizador. Estilos propios,
     con prefijo, para no heredar ni pisar los del juego. */
  let estilo = false;
  function ponEstilo() {
    if (estilo) return; estilo = true;
    const s = document.createElement('style');
    s.textContent = '.vj-ctl{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 4px;border-radius:999px;border:1px solid rgba(128,128,128,.35);background:rgba(128,128,128,.12);color:inherit;font:600 12px system-ui,sans-serif;line-height:1;vertical-align:middle}' +
      '.vj-ctl button{all:unset;cursor:pointer;width:26px;height:26px;display:grid;place-items:center;border-radius:50%;font-size:15px}' +
      '.vj-ctl button:hover{background:rgba(128,128,128,.2)}.vj-ctl button:focus-visible,.vj-ctl input:focus-visible{outline:2px solid currentColor;outline-offset:2px}' +
      '.vj-ctl input{width:88px;margin:0;cursor:pointer;accent-color:currentColor}.vj-ctl output{min-width:3.2ch;text-align:right;opacity:.75;font-variant-numeric:tabular-nums}' +
      '.vj-ctl.mudo input,.vj-ctl.mudo output{opacity:.4}';
    (document.head || document.documentElement).appendChild(s);
  }
  function control(host) {
    if (!host || host.querySelector(':scope > .vj-ctl')) return null;
    ponEstilo();
    const el = document.createElement('div');
    el.className = 'vj-ctl'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Volumen del juego');
    el.innerHTML = '<button type="button"></button><input type="range" min="0" max="100" step="1" aria-label="Volumen"><output></output>';
    const b = el.querySelector('button'), r = el.querySelector('input'), o = el.querySelector('output');
    const c = {
      pinta() {
        el.classList.toggle('mudo', mudo);
        b.textContent = mudo || vol === 0 ? '🔇' : vol < 40 ? '🔈' : vol < 75 ? '🔉' : '🔊';
        const t = mudo ? 'Activar el sonido' : 'Silenciar';
        b.title = t; b.setAttribute('aria-label', t); b.setAttribute('aria-pressed', String(mudo));
        if (document.activeElement !== r) r.value = vol;
        o.textContent = vol + '%';
      }
    };
    b.addEventListener('click', e => { e.stopPropagation(); VolumenJuego.silenciar(!mudo); });
    r.addEventListener('input', e => { e.stopPropagation(); VolumenJuego.fijar(r.value); });
    // Las teclas del deslizador no deben mover la pieza ni disparar.
    for (const t of ['keydown', 'keyup', 'pointerdown', 'mousedown', 'click']) el.addEventListener(t, e => e.stopPropagation());
    controles.add(c); c.pinta();
    host.appendChild(el);
    return el;
  }

  window.VolumenJuego = {
    volumen: () => vol, silenciado: () => mudo, factor,
    fijar(v) { vol = acota(v); if (vol > 0 && mudo) { mudo = false; guarda(K_MUDO, '0'); } guarda(K_VOL, vol); aplica(); },
    silenciar(v) { mudo = !!v; guarda(K_MUDO, mudo ? '1' : '0'); aplica(); },
    control
  };
  window.addEventListener('storage', e => {
    if (e.key === K_VOL) vol = acota(e.newValue ?? 80);
    else if (e.key === K_MUDO) mudo = e.newValue === '1';
    else return;
    aplica();
  });
  const monta = () => document.querySelectorAll('[data-volumen]').forEach(control);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta); else monta();
})();
