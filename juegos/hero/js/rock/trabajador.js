// Batalla de Rock de fondo, en un worker: la escena (./escena.js) dibuja en un OffscreenCanvas que le pasa la
// página, así el 3D no le quita tiempo al hilo de PRO HERO (la pista, las notas, el audio). Se empaqueta con
// esbuild en juegos/hero/rock-trabajador.js (`npm run build:rock`): en un worker no hay mapa de módulos.
//
// Mensajes de la página (sitio/rock.js):
//   {t:'lienzo', canvas, w, h, dpr}  el OffscreenCanvas (una sola vez) → carga la escena y contesta {t:'listo'}
//   {t:'tam', w, h, dpr} · {t:'oculto', on} · {t:'monta'} · {t:'desmonta'}
//   {t:'vivo', yo, rival, alto} · {t:'pulso', beats, animo, hype, dtJuego} · {t:'ataque', quien}
//   {t:'hype', kind, text, color} · {t:'fin', ganador, texto}
// Al worker se le contesta {t:'listo'}, {t:'error', m} y {t:'demasiado'} (el juego no da ni con el mínimo).
let rock = null;
const cola = [];

async function inicia(d) {
  globalThis.ROCK_LIENZO = d.canvas;
  try {
    const m = await import('./escena.js');
    rock = m.rock;
    rock.tam(d.w, d.h, d.dpr);
    postMessage({ t: 'listo' });
    for (const x of cola.splice(0)) atiende(x);
  } catch (err) {
    postMessage({ t: 'error', m: String((err && err.message) || err) });
  }
}

function atiende(d) {
  if (!rock) { cola.push(d); return; }
  switch (d.t) {
    case 'tam': rock.tam(d.w, d.h, d.dpr); break;
    case 'oculto': rock.oculto(d.on); break;
    case 'monta': rock.monta(null); break;
    case 'desmonta': rock.desmonta(); break;
    case 'vivo': rock.enVivo({ yo: d.yo, rival: d.rival, alto: d.alto, alDemasiado: () => postMessage({ t: 'demasiado' }) }); break;
    case 'pulso': rock.pulso(d); break;
    case 'ataque': rock.ataque(d.quien); break;
    case 'hype': rock.hype(d.kind, d.text, d.color); break;
    case 'fin': rock.fin(d.ganador, d.texto); break;
  }
}

onmessage = (e) => {
  const d = e.data || {};
  if (d.t === 'lienzo') inicia(d);
  else atiende(d);
};
