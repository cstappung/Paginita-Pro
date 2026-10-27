// La prueba de conexión de la sala, piloto por piloto — bitácora §100 (crítico de la red, H1.2).
//
// Resumen: mientras la sala elige la copa, el personaje y entre carreras, cada página mira cada 2 s cómo le llega cada
// uno de los otros pilotos y lo dice con un ícono:
//   🟢 directa      la conexión WebRTC propia con ese piloto está sana (con su ida y vuelta en ms);
//   🛰 repetidor    también anda, pero pasando por el TURN de Cloudflare (los dos navegadores no lograron hablarse
//                   directo: un poco más de demora, pero se juega igual);
//   🔴 por otro     sin conexión propia: lo que manda llega pasado por un tercero (la sala, §100 H1.4). Se juega, pero
//                   si ese tercero se va, se pierde;
//   🔴 sin          ni directa ni por otro: ese piloto no está llegando;
//   ⏳ conectando   los primeros 15 s sin conexión (WebRTC todavía busca camino).
// Lo dibuja la página (un aviso en la esquina solo cuando hay 🔴) y se lo pasa al vestíbulo del sitio, que pone el
// ícono al lado de cada piloto de la tira. Como el probador de continuidad de un tablero: un LED por cada cable,
// verde si conecta directo, amarillo si pasa por un puente, rojo si está cortado.
//
// No arma conexiones de prueba propias: mira las de la malla de la sala (malla.sano/camino) y lo que oye la sala
// (sala.oido: cuándo le llegó algo de ese piloto, directo o por otro).
//
// Uso:  const c = crearConexiones({ malla, sala, quienes: () => [uid…], alCambiar: lista => … });
//       c.lista()  → [{ uid, e: 'directa'|'repetidor'|'puente'|'sin'|'conectando', ms, por }]   c.detener()

export const ICONO = { directa: '🟢', repetidor: '🛰', puente: '🔴', sin: '🔴', conectando: '⏳' };
export const OIDO_MS = 3000;          // lo oído hace menos que esto cuenta como «llega»
export const CONECTANDO_MS = 15000;   // sin conexión hace menos que esto = todavía conectando
export const CADA_MS = 2000;          // cada cuánto se mira

// cómo llega un piloto: sano = la malla dice que su conexión propia anda; camino = lo de getStats (relevo = por el
// TURN, ms = ida y vuelta) o null; oido = lo que oyó la sala ({ hace, directo, por }, ms desde lo último); malMs = hace
// cuánto que no está sana su conexión propia
export function clasificar({ sano = false, camino = null, oido = null, malMs = Infinity } = {}) {
  const ms = Number.isFinite(camino?.ms) ? camino.ms : null;
  // (sana, o recién le llegó algo directo: un tirón de la conexión, «disconnected» un segundo, sigue siendo directa)
  if (sano || (oido && oido.directo < OIDO_MS)) return { e: camino?.relevo ? 'repetidor' : 'directa', ms };
  if (oido && oido.hace < OIDO_MS) return { e: 'puente', por: oido.por || null };
  if (malMs < CONECTANDO_MS) return { e: 'conectando' };
  return { e: 'sin' };
}

// el texto de una fila (para el título del ícono y el aviso): nombre = el del piloto; nombreDe = el de otro uid
export function textoConexion(c, nombre, nombreDe = u => u) {
  if (!c) return '';
  if (c.e === 'directa') return `${nombre}: conexión directa${c.ms != null ? ` · ${c.ms} ms` : ''}`;
  if (c.e === 'repetidor') return `${nombre}: por el repetidor${c.ms != null ? ` · ${c.ms} ms` : ''}`;
  if (c.e === 'puente') return `${nombre}: sin conexión directa${c.por ? ` (le llega por ${nombreDe(c.por)})` : ' (le llega por otro piloto)'}`;
  if (c.e === 'conectando') return `${nombre}: conectando…`;
  return `${nombre}: sin conexión`;
}

// el aviso de la esquina: solo los 🔴 (lo demás anda); '' si no hay
export function avisoConexiones(lista, nombreDe = u => u) {
  const malos = (lista || []).filter(c => c.e === 'puente' || c.e === 'sin');
  if (!malos.length) return '';
  return '🔴 ' + malos.map(c => textoConexion(c, nombreDe(c.uid), nombreDe)).join(' · ');
}

export function crearConexiones({ malla, sala, quienes = () => [], alCambiar = () => {}, cada = CADA_MS,
  ahora = () => performance.now(), reloj = (f, ms) => setInterval(f, ms), parar = id => clearInterval(id) } = {}) {
  let lista = [], firma = '', corriendo = false, avisados = new Map();   // (avisados: uid → los ms del último aviso)
  const malDesde = new Map();       // uid → desde cuándo no está sana su conexión propia
  const anduvo = new Set();         // los que alguna vez tuvieron la conexión sana (si se cae, vuelve a «conectando»)
  const inicio = ahora();

  async function mirar() {
    if (corriendo) return;           // (getStats es asíncrono: no se apilan)
    corriendo = true;
    try {
      const t = ahora(), nueva = [];
      for (const u of quienes()) {
        const sano = !!malla?.sano?.(u);
        // (sin conexión desde que se abrió la página, o desde que se le cayó la que tenía)
        if (sano) { malDesde.delete(u); anduvo.add(u); } else if (!malDesde.has(u)) malDesde.set(u, anduvo.has(u) ? t : inicio);
        const camino = sano ? await malla.camino?.(u).catch?.(() => null) ?? null : null;
        const c = clasificar({ sano, camino, oido: sala?.oido?.(u) ?? null, malMs: sano ? 0 : t - malDesde.get(u) });
        nueva.push({ uid: u, ...c });
      }
      lista = nueva;
      // (los ms cambian un poco cada vez: se avisa si cambia el estado o si la ida y vuelta se movió más de 10 ms desde
      // la última avisada; como un comparador con histéresis, que no tirita con el ruido)
      const f = JSON.stringify(nueva.map(c => [c.uid, c.e, c.por || '']));
      const movio = nueva.some(c => { const a = avisados.get(c.uid); return (c.ms == null) !== (a == null) || (c.ms != null && Math.abs(c.ms - a) > 10); });
      if (f !== firma || movio) { firma = f; avisados = new Map(nueva.map(c => [c.uid, c.ms ?? null])); alCambiar(lista); }
    } catch (e) { console.warn('[conexiones]', e); }
    finally { corriendo = false; }
  }

  const id = reloj(mirar, cada);
  mirar();
  return { lista: () => lista, mirar, detener: () => parar(id) };
}
