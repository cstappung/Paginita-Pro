// El puente de la señal del banco entre perfiles de Chrome (bitácora §269).
//
// Resumen: en el banco, la sala se encuentra por un «Firebase de mentira» hecho con BroadcastChannel (`senalCanal` de
// malla.mjs, el canal «mkw-senal-<sala>»). Ese canal solo llega a las pestañas del MISMO perfil. Las pruebas que quieren
// «otra PC» de verdad abren cada pestaña en su propio perfil (otro contexto de Playwright: otra caché, otro localStorage),
// y ahí la señal no cruzaba: la invitada quedaba sola en su sala. Medido el 2026-11-10: la tabla «Single Player contra la
// sala» y la vuelta 3 en la sala salieron con la invitada sin conectar. Esto tiende un cable entre los perfiles: cada
// mensaje que una pestaña escribe en un canal «mkw-senal-…» también lo lleva Node a las pestañas de los OTROS perfiles
// (las del mismo perfil ya lo reciben por el canal). Solo la señal (presencia y buzón): la carrera va después por WebRTC,
// que sí cruza. Los demás canales (los mandos entre ventanas, el disco) no cruzan: son de cada PC.
// Como un repetidor entre dos tableros: la señal de uno se copia en el otro, y nada más.
// Uso:  import { puenteSenal } from './puente-contextos.mjs';
//       const puente = puenteSenal();  …  await puente.agregar(contexto)   (antes de abrir sus páginas)
export function puenteSenal() {
  const contextos = [];
  const script = () => {
    const Original = window.BroadcastChannel;
    if (!Original || Original.__puente) return;
    const canales = [];
    class Canal extends Original {
      constructor(nombre) { super(nombre); this.__nombre = String(nombre); canales.push(this); }
      postMessage(m) {
        super.postMessage(m);
        if (this.__nombre.startsWith('mkw-senal-')) try { window.__puenteSenal?.(this.__nombre, JSON.stringify(m)); } catch {}
      }
      close() { const i = canales.indexOf(this); if (i >= 0) canales.splice(i, 1); super.close(); }
    }
    Canal.__puente = true;
    window.BroadcastChannel = Canal;
    // lo que llega por el puente: a cada canal de ese nombre de esta pestaña, como si hubiera llegado por el canal
    window.__puenteRecibe = (nombre, m) => {
      const data = JSON.parse(m);
      for (const c of canales) if (c.__nombre === nombre) c.dispatchEvent(new MessageEvent('message', { data }));   // (también llama a onmessage)
    };
  };
  return {
    async agregar(contexto) {
      contextos.push(contexto);
      await contexto.exposeBinding('__puenteSenal', async ({ page }, nombre, m) => {
        for (const c of contextos) if (c !== contexto) for (const p of c.pages()) p.evaluate(([n, x]) => window.__puenteRecibe?.(n, x), [nombre, m]).catch(() => {});
      });
      await contexto.addInitScript(script);
    },
  };
}
