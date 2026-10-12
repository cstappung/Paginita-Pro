/* Pokelike — la Pokédex que dura entre partidas. Vive en localStorage
   (`pokelike.dex`) y, con la sesión del sitio iniciada, también en
   `pokedex/<uid>` (Firebase, por `nube.js`). Nada de esto toca el motor.

   Forma: { d, medallas, liga }. `d` son 151 caracteres, uno por especie
   (posición e−1): '0' sin ver, '1' visto, '2' capturado. `medallas` es el
   récord de medallas (0–8) y `liga` vale 1 si alguna vez ganó la Liga.
   Todo solo crece, así que juntar dos copias (navegador y cuenta, o dos
   dispositivos) es quedarse con el máximo de cada campo: `mezclar`. */
(function (raiz, fabrica) {
  const P = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = P;
  else raiz.PokelikeDex = P.navegador(raiz);
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';
  const N = 151;
  const VACIA = '0'.repeat(N);
  const entero = (x, max) => Number.isInteger(x) ? Math.max(0, Math.min(max, x)) : 0;

  function normaliza(x) {
    x = x || {};
    return {
      d: typeof x.d === 'string' && /^[012]{151}$/.test(x.d) ? x.d : VACIA,
      medallas: entero(x.medallas, 8),
      liga: entero(x.liga, 1),
    };
  }

  function mezclar(a, b) {
    const A = normaliza(a), B = normaliza(b);
    let d = '';
    for (let i = 0; i < N; i++) d += A.d[i] > B.d[i] ? A.d[i] : B.d[i];
    return { d, medallas: Math.max(A.medallas, B.medallas), liga: Math.max(A.liga, B.liga) };
  }

  const iguales = (a, b) => a.d === b.d && a.medallas === b.medallas && a.liga === b.liga;

  function marca(dex, e, nivel) {
    const i = e - 1;
    if (!(i >= 0 && i < N) || dex.d[i] >= String(nivel)) return false;
    dex.d = dex.d.slice(0, i) + nivel + dex.d.slice(i + 1);
    return true;
  }

  function cuenta(dex) {
    let vistos = 0, capturados = 0;
    for (const c of dex.d) { if (c !== '0') vistos++; if (c === '2') capturados++; }
    return { vistos, capturados, total: N, medallas: dex.medallas, liga: dex.liga };
  }

  function navegador(win) {
    const K = 'pokelike.dex';
    const ESPERA_NUBE_MS = 1500;
    let dex = normaliza((() => { try { return JSON.parse(win.localStorage.getItem(K) || 'null'); } catch (_) { return null; } })());
    let nube = null, usuario = null, estadoNube = 'fuera', pendiente = null;
    const oyentes = new Set();
    const avisa = () => oyentes.forEach(cb => { try { cb(); } catch (_) { /* un oyente roto no frena a los demás */ } });

    const guardaLocal = () => { try { win.localStorage.setItem(K, JSON.stringify(dex)); } catch (_) { /* sin almacenamiento */ } };

    async function sincroniza() {
      clearTimeout(pendiente); pendiente = null;
      if (!nube || !usuario) return;
      const uid = usuario.uid;
      estadoNube = 'sincronizando'; avisa();
      try {
        const remota = await nube.mezcla(uid, dex, mezclar, iguales);
        if (!usuario || usuario.uid !== uid) return;
        dex = mezclar(dex, remota); guardaLocal();
        estadoNube = 'al-dia';
      } catch (err) {
        console.warn('Pokédex: no se pudo sincronizar con la cuenta', err);
        estadoNube = 'error';
      }
      avisa();
    }
    const programa = () => { if (usuario && !pendiente) pendiente = setTimeout(sincroniza, ESPERA_NUBE_MS); };
    win.addEventListener('visibilitychange', () => { if (win.document.visibilityState === 'hidden' && pendiente) sincroniza(); });

    function cambio(hubo) {
      if (!hubo) return false;
      guardaLocal(); programa(); avisa();
      return true;
    }

    return {
      N,
      estado: e => Number(dex.d[e - 1] || 0),
      resumen: () => cuenta(dex),
      ve: e => cambio(marca(dex, e, 1)),
      /* La run en curso: su equipo cuenta como capturado y sus medallas
         como récord. Las partidas de prueba no cuentan. */
      registraRun(run) {
        if (!run || run.debug) return false;
        let hubo = false;
        for (const p of run.equipo) hubo = marca(dex, p.e, 2) || hubo;
        if (run.medallas > dex.medallas) { dex.medallas = Math.min(8, run.medallas); hubo = true; }
        if (run.resultado === 'victoria' && !dex.liga) { dex.liga = 1; hubo = true; }
        return cambio(hubo);
      },
      alCambiar(cb) { oyentes.add(cb); return () => oyentes.delete(cb); },
      cuenta: () => ({ usuario, estado: estadoNube, disponible: !!nube }),
      entrar: () => nube && nube.entrar(),
      salir: () => nube && nube.salir(),
      conectar(api) {
        nube = api;
        estadoNube = 'cargando'; avisa();
        api.alCambiar(u => {
          usuario = u;
          estadoNube = u ? 'sincronizando' : 'fuera';
          avisa();
          if (u) sincroniza();
        });
      },
    };
  }

  return { N, normaliza, mezclar, iguales, marca, cuenta, navegador };
});
