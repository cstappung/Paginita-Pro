// Batalla de Rock de fondo, en un worker: la escena (./escena.js) dibuja en un OffscreenCanvas que le pasa la
// página, así el 3D no le quita tiempo al hilo de PRO HERO (la pista, las notas, el audio). Se empaqueta con
// esbuild en juegos/hero/rock-trabajador.js (`npm run build:rock`): en un worker no hay mapa de módulos.
//
// Mensajes de la página (sitio/rock.js):
//   {t:'lienzo', canvas, w, h, dpr}  el OffscreenCanvas (una sola vez) → carga la escena y contesta {t:'listo'}
//   {t:'tam', w, h, dpr} · {t:'oculto', on} · {t:'monta'} · {t:'desmonta'}
//   {t:'vivo', yo, rival, otros, alto} · {t:'pulso', beats, animo, humor, hype, dtJuego, toca, solo, confs, golpes, seg, fuego}
//   {t:'musica', d} (la canción analizada, ritmo.js: analizaMusica)
//   {t:'carga', quien} · {t:'poder', quien, on} · {t:'ataque', quien} · {t:'hype', kind, text, color} · {t:'fin', ganador, texto}
// El worker contesta {t:'listo'}, {t:'error', m}, {t:'preparado'} (la canción ya puede empezar) y {t:'demasiado'}
// (el juego no da ni con el mínimo).
//
// **Modo fotógrafo** (las miniaturas de las piezas: el editor, el salón y el mercado de Juegos): la página manda
// {t:'fotografo'} en vez de 'lienzo' y el worker se arma su propio OffscreenCanvas chico; después, por cada
// {t:'foto', id, v} contesta {t:'foto', id, blob} (webp, o null si no se pudo). Así la página no arma rockeros
// ni espera a la tarjeta gráfica para leer cada foto, que era lo que la trababa.
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
    case 'vivo':
      Promise.resolve(rock.enVivo({ yo: d.yo, rival: d.rival, otros: d.otros || [], alto: d.alto, alDemasiado: () => postMessage({ t: 'demasiado' }) }))
        .catch((err) => console.warn('[rock] enVivo', err))
        .then(() => postMessage({ t: 'preparado' }));
      break;
    case 'carga': rock.carga(d.quien); break;
    case 'poder': rock.poder(d.quien, d.on); break;
    case 'pulso': rock.pulso(d); break;
    case 'musica': rock.musica(d.d); break;
    case 'ataque': rock.ataque(d.quien); break;
    case 'hype': rock.hype(d.kind, d.text, d.color); break;
    case 'fin': rock.fin(d.ganador, d.texto); break;
    case 'foto':
      rock.foto(d.v)
        .catch((err) => { console.warn('[rock] foto', d.id, err); return null; })
        .then((blob) => postMessage({ t: 'foto', id: d.id, blob }));
      break;
  }
}

onmessage = (e) => {
  const d = e.data || {};
  if (d.t === 'lienzo') inicia(d);
  else if (d.t === 'fotografo') { globalThis.ROCK_FOTOGRAFO = true; inicia({ canvas: new OffscreenCanvas(192, 192), w: 192, h: 192, dpr: 1 }); }
  else atiende(d);
};
