// El contador de los que faltan (bitácora §78, sobre la regla «DNF» de §77), con los números de la cuenta de salida.
//
// Resumen: en la sala, cuando el primer corredor cruza la meta (humano o CPU), el juego da 30 s a los demás; al vencer,
// les termina la carrera en el puesto en que van (lockstep_nativo.cpp). Esto lo muestra en la página para meter
// presión, al centro de la imagen del juego, entre el HUD de arriba y la pista (desde el 20 % del alto, para no caer
// sobre los carteles de la meta): un número grande como el «3, 2, 1» de la salida y un letrero
// («¡LLEGÓ EL 1.º!» los primeros 2 s, después «¡A LA META!»); a quien ya llegó, uno chico y tranquilo («ESPERANDO A LOS
// DEMÁS»). En los últimos 10 cada número entra como en la salida (gigante → su tamaño en 150 ms, con el destello) y en
// los últimos 5 suena un pitido por segundo.
//
// Se ve como el juego porque ES el juego: las letras salen de la fuente que el juego ya cargó (UI/Font.szs de Retro
// Rewind; fuente-wii.mjs la abre en el momento, nada del juego se guarda ni se sube aparte) y los colores son los de la
// cuenta de salida (Race.szs: go.brlyt y go_fade_in.brlan, leídos con los formatos públicos de Tockdom):
//   - el 3, el 2 y el 1 salen de la misma fuente de la cuenta (tt_kart_font_rodan_ntlg_pro_b, que trae solo 1, 2 y 3);
//   - los demás números y el letrero, de la fuente de los menús (kart_kanji_font: la misma letra, con todo);
//   - relleno = «blanco» del material text_01 (255,137,137) y borde = su «negro» (70,70,70), los dos multiplicados por el
//     degradado de la caja de texto (amarillo #F2FF00 arriba, #FFE100 abajo) → naranja #F28900 con borde oliva #424600;
//   - la entrada: escala 90 → 2 en 9 cuadros (aquí 2,6× → 1×, para no tapar la pista), silueta blanca-amarilla (text_00)
//     que aparece mientras entra, destello blanco (text_light) al llegar, y después crece 10 % despacio (2 → 2,2).
// Si la fuente no se puede leer (sin disco, o en una prueba sin juego), escribe con una letra del navegador parecida.
// Todo se lee del juego en cada cuadro de la pantalla, así que cuenta en el tiempo de la carrera (el mismo reloj con
// el que vence el plazo de verdad), no en el del navegador: si la carrera se frena esperando a otro, el contador también.
// Como el display de un temporizador conectado al mismo reloj que dispara el relé: lo que muestra es lo que va a pasar.
//
// Lo que lee (memoria de la Wii, big-endian, con el lector de menus.mjs):
//   Raceinfo 0x809BD730: +0x28 etapa (2 = corriendo), +0x14 → el reloj (minutos +0x8, segundos +0xA, milésimas +0xC),
//     +0xC → los RaceinfoPlayer (cada uno +0x38, bit 0x2 = cruzó la meta);
//   Racedata 0x809BD728: escenario de la carrera +0x20, +0xB64 = el puesto que muestra la pantalla de esta consola (el mío);
//   Module._mkw_sala_dnf_desde() = el reloj de la carrera cuando llegó el primero (−1 = nadie todavía).
//
// Uso:  const c = crearCuentaDnf({ M, lector: () => window.mkwMenus, leerArchivo: ruta => bytes });  (y M._mkw_sala_dnf(DNF_MS))
//       c.estado() → { visible, modo: 'apurate'|'espera'|null, segundos, letrero, texto, fuente: 'juego'|'reserva' }
//       c.listo (promesa: la fuente ya se intentó leer) · c.detener()
//       pruebas: manual: true (sin requestAnimationFrame: c.actualizar()), pitido: () => …, documento
import { abrirSzs, abrirBrfnt, pintar, filasConTinta } from './fuente-wii.mjs';

export const DNF_MS = 30000;          // el plazo: el mismo que usa el juego (la página se lo pasa con _mkw_sala_dnf)
const URGENTE_S = 10;                  // desde aquí, cada número entra como en la salida
const PITIDOS_S = 5;                   // y en estos últimos, un pitido por segundo
const AVISO_MS = 2000;                 // «¡LLEGÓ EL 1.º!» los primeros 2 s del plazo; después «¡A LA META!»
// Dónde está la fuente: primero la de Retro Rewind (la que el juego carga en lugar de la del disco), después la del disco
export const RUTAS_FUENTE = ['/mkw/sd/RetroRewind6/UI/Font.szs', '/mkw/disco/files/Scene/UI/Font.szs'];
const FUENTE_TEXTO = '/kart_kanji_font.brfnt', FUENTE_CUENTA = '/tt_kart_font_rodan_ntlg_pro_b.brfnt';

// Paletas (ver arriba): borde y relleno del material × degradado de la caja de texto, arriba → abajo
export const PALETAS = {
  naranja: { borde: [70, 70, 70], relleno: [255, 137, 137], arriba: [242, 255, 0], abajo: [255, 225, 0] },    // text_01
  silueta: { borde: [255, 255, 255], relleno: [255, 255, 255], arriba: [242, 255, 0], abajo: [255, 255, 255] }, // text_00 al llegar
  blanco: { borde: [24, 24, 24], relleno: [255, 255, 255], arriba: [255, 255, 255], abajo: [214, 214, 214] },   // letreros
};

const ESTILO = `
.cuenta-dnf { position: fixed; z-index: 6; left: 0; top: 0; width: 100vw; height: 100vh; container-type: size; pointer-events: none; }
.cuenta-dnf[hidden] { display: none; }
.cuenta-dnf-pila { display: flex; flex-direction: column; align-items: center; gap: .6cqh; margin-top: 20cqh;
  filter: drop-shadow(0 0 .5cqh #000c) drop-shadow(0 .5cqh .7cqh #0008); }
.cuenta-dnf-numero { position: relative; height: max(11cqh, 30px); }
.cuenta-dnf-numero canvas { display: block; height: 100%; width: auto; }
.cuenta-dnf-numero .silueta { position: absolute; left: 0; top: 0; opacity: 0; }
.cuenta-dnf-pila > .cuenta-dnf-letrero { display: block; height: max(4.6cqh, 12px); width: auto; max-width: 100cqw; }
.cuenta-dnf.espera .cuenta-dnf-numero { height: max(6cqh, 18px); }
.cuenta-dnf.espera .cuenta-dnf-pila > .cuenta-dnf-letrero { height: max(3.4cqh, 10px); }
.cuenta-dnf.espera .cuenta-dnf-pila { opacity: .92; }
.cuenta-dnf-numero.golpe { animation: dnf-golpe 150ms linear both, dnf-crece 850ms linear 150ms both; }
.cuenta-dnf-numero.golpe .cara { animation: dnf-cara 150ms step-end both; }
.cuenta-dnf-numero.golpe .silueta { animation: dnf-silueta 280ms linear both; }
.cuenta-dnf-numero.tic { animation: dnf-tic 160ms ease-out both; }
.cuenta-dnf-numero.tic .silueta { animation: dnf-destello 200ms linear both; }
@keyframes dnf-golpe { from { transform: scale(var(--dnf-desde, 2.6)); } to { transform: none; } }
@keyframes dnf-crece { from { scale: 1; } to { scale: 1.1; } }
@keyframes dnf-cara { from { opacity: 0; } to { opacity: 1; } }
@keyframes dnf-silueta { 0% { opacity: 0; } 53.5% { opacity: 1; } 100% { opacity: 0; } }
@keyframes dnf-tic { from { transform: scale(1.12); } to { transform: none; } }
@keyframes dnf-destello { from { opacity: .8; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .cuenta-dnf-numero, .cuenta-dnf-numero canvas { animation: none !important; } }
`;

// Un pitido corto (WebAudio): agudo y suave, para no tapar el juego
let audio = null;
function pitidoPorOmision(ultimo) {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.type = 'square'; o.frequency.value = ultimo ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + (ultimo ? 0.35 : 0.12));
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.4);
  } catch {}
}

// Las dos fuentes del juego, del primer Font.szs que se pueda leer (null = no se pudo: se usa la letra de reserva)
export async function cargarFuentes(leerArchivo) {
  for (const ruta of RUTAS_FUENTE) {
    try {
      const bytes = await leerArchivo(ruta);
      if (!bytes?.length) continue;
      const archivos = abrirSzs(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
      const texto = abrirBrfnt(archivos.get(FUENTE_TEXTO));
      if (!texto.tiene('0123456789¡!ÓÉº.')) continue;
      let cuenta = null;
      try { cuenta = archivos.has(FUENTE_CUENTA) ? abrirBrfnt(archivos.get(FUENTE_CUENTA)) : null; } catch {}
      const numeros = filasConTinta(texto, '0123456789'), letras = filasConTinta(texto, '¡!ABDEGLMNOPRSTÁÉÓº.…');
      return { ruta, texto, cuenta, numeros, letras, cuentaNumeros: cuenta ? filasConTinta(cuenta, '123') : null };
    } catch {}
  }
  return null;
}

// La letra de reserva (sin la fuente del juego): gruesa, con borde, y los mismos colores
function pintarReserva(texto, paleta, documento, lienzo) {
  const c = lienzo || documento.createElement('canvas'), alto = 44, px = 38;
  const ctx = c.getContext('2d');
  const fuente = `900 ${px}px "Arial Black", "Lilita One", system-ui, sans-serif`;
  ctx.font = fuente;
  c.width = Math.ceil(ctx.measureText(texto).width + px * 0.4); c.height = alto;
  ctx.font = fuente; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const mezcla = (a, b) => `rgb(${a.map((x, i) => Math.round(x * b[i] / 255)).join(',')})`;
  const deg = ctx.createLinearGradient(0, 0, 0, alto);
  deg.addColorStop(0, mezcla(paleta.relleno, paleta.arriba)); deg.addColorStop(1, mezcla(paleta.relleno, paleta.abajo));
  ctx.lineWidth = px * 0.2; ctx.strokeStyle = mezcla(paleta.borde, paleta.arriba);
  ctx.strokeText(texto, c.width / 2, alto / 2 + 1);
  ctx.fillStyle = deg; ctx.fillText(texto, c.width / 2, alto / 2 + 1);
  return c;
}

export function crearCuentaDnf({ M, lector, leerArchivo = null, documento = document, manual = false, pitido = pitidoPorOmision,
                                 plazoMs = DNF_MS } = {}) {
  if (!documento.getElementById('estilo-cuenta-dnf')) {
    const st = documento.createElement('style'); st.id = 'estilo-cuenta-dnf'; st.textContent = ESTILO; documento.head.appendChild(st);
  }
  const caja = documento.createElement('div');
  caja.id = 'cuentaDnf'; caja.className = 'cuenta-dnf'; caja.hidden = true;
  caja.setAttribute('role', 'timer');
  caja.innerHTML = '<div class="cuenta-dnf-pila"><div class="cuenta-dnf-numero"><canvas class="cara"></canvas>' +
    '<canvas class="silueta"></canvas></div><canvas class="cuenta-dnf-letrero"></canvas></div>';
  documento.body.appendChild(caja);
  const numero = caja.querySelector('.cuenta-dnf-numero'), cara = caja.querySelector('.cara'),
        silueta = caja.querySelector('.silueta'), letreroLz = caja.querySelector('.cuenta-dnf-letrero');
  let modo = null, segundos = -1, pitado = -1, letrero = '', vivo = true, fuentes = null, fuenteNumero = '';

  // La fuente del juego: se lee una vez, sin apuro (mientras tanto, y si no se puede, la letra de reserva)
  const listo = (leerArchivo ? cargarFuentes(leerArchivo) : Promise.resolve(null))
    .then(f => { fuentes = f; if (modo) { segundos = -1; letrero = ''; } return f; });

  // Escribir un texto con la fuente que toque. cual: 'numero' (el 3, 2 y 1 solos, con la fuente de la cuenta) o 'letrero'
  function escribir(texto, paleta, lienzo, cual) {
    if (!fuentes) return pintarReserva(texto, paleta, documento, lienzo);
    if (cual === 'numero' && fuentes.cuenta && /^[123]$/.test(texto) && fuentes.cuenta.tiene(texto))
      return pintar(fuentes.cuenta, texto, paleta, documento, lienzo, fuentes.cuentaNumeros);
    return pintar(fuentes.texto, texto, paleta, documento, lienzo, cual === 'numero' ? fuentes.numeros : fuentes.letras);
  }

  // Encima de la imagen 16:9 del juego (el <canvas id="canvas"> va con object-fit: contain: puede haber franjas)
  function colocar() {
    const lienzo = documento.getElementById('canvas');
    if (!lienzo || !lienzo.width || !lienzo.height) { Object.assign(caja.style, { left: '0px', top: '0px', width: '100vw', height: '100vh' }); return; }
    const r = lienzo.getBoundingClientRect(), s = Math.min(r.width / lienzo.width, r.height / lienzo.height);
    let w = lienzo.width * s, h = lienzo.height * s;          // lo que ocupa el canvas en pantalla (object-fit: contain)
    // y adentro, el juego dibuja su capa 2D (HUD, cuenta de salida) siempre en 16:9 al centro (§79: SDL3 le pone al
    // canvas el tamaño de su recuadro y el juego, con force_16_9, deja franjas negras dentro del canvas)
    if (w / h > 16 / 9) w = h * 16 / 9; else h = w * 9 / 16;
    Object.assign(caja.style, { left: `${r.left + (r.width - w) / 2}px`, top: `${r.top + (r.height - h) / 2}px`, width: `${w}px`, height: `${h}px` });
  }
  const alCambiarTamaño = () => { if (modo) colocar(); };
  documento.defaultView?.addEventListener('resize', alCambiarTamaño);

  // lo que dice el juego ahora: null = no hay cuenta (nadie llegó, no hay carrera, o ya venció)
  function leer() {
    const L = typeof lector === 'function' ? lector() : lector;
    const desde = M?._mkw_sala_dnf_desde?.() ?? -1;
    if (!L || desde < 0) return null;
    const ri = L.u32(0x809BD730);
    if (!ri || L.u32(ri + 0x28) !== 2) return null;
    const r = L.u32(ri + 0x14);
    if (!r) return null;
    const reloj = (L.u16(r + 0x8) * 60 + L.u8(r + 0xA)) * 1000 + L.u16(r + 0xC);
    const quedan = desde + plazoMs - reloj;
    if (quedan <= 0) return null;
    const rd = L.u32(0x809BD728), yo = rd ? L.u8(rd + 0x20 + 0xB64) : 0xFF, lista = L.u32(ri + 0xC);
    const p = yo < 12 && lista ? L.u32(lista + 4 * yo) : 0;
    const llegue = p ? (L.u32(p + 0x38) & 2) !== 0 : false;
    return { segundos: Math.ceil(quedan / 1000), pasaron: plazoMs - quedan, llegue };
  }

  function animar(clase, desde) {
    numero.classList.remove('golpe', 'tic');
    if (!clase) return;
    numero.style.setProperty('--dnf-desde', String(desde));
    void numero.offsetWidth;                                  // (para que la animación arranque de nuevo)
    numero.classList.add(clase);
  }

  function actualizar() {
    const x = leer();
    if (!x) {
      if (modo) { caja.hidden = true; caja.className = 'cuenta-dnf'; modo = null; segundos = -1; pitado = -1; letrero = ''; animar(null); }
      return;
    }
    const nuevoModo = x.llegue ? 'espera' : 'apurate';
    const primera = !modo;
    if (nuevoModo !== modo) { modo = nuevoModo; segundos = -1; letrero = ''; caja.className = `cuenta-dnf ${modo}`; colocar(); }
    const quiero = modo === 'espera' ? 'ESPERANDO A LOS DEMÁS' : x.pasaron < AVISO_MS ? '¡LLEGÓ EL 1.º!' : '¡A LA META!';
    if (quiero !== letrero) { letrero = quiero; escribir(letrero, PALETAS.blanco, letreroLz, 'letrero'); }
    if (x.segundos !== segundos) {
      segundos = x.segundos;
      const texto = String(segundos);
      if (modo === 'espera') { escribir(texto, PALETAS.blanco, cara, 'numero'); animar(null); }
      else {
        escribir(texto, PALETAS.naranja, cara, 'numero');
        escribir(texto, PALETAS.silueta, silueta, 'numero');
        fuenteNumero = fuentes ? (fuentes.cuenta && /^[123]$/.test(texto) ? 'cuenta' : 'texto') : 'reserva';
        // la entrada de la salida: al aparecer y en los últimos 10 (el 3, 2, 1 desde más lejos, como en la salida)
        if (primera || segundos <= URGENTE_S) animar('golpe', segundos <= 3 ? 2.6 : 2);
        else animar('tic');
      }
      caja.setAttribute('aria-label', modo === 'apurate' ? `Te quedan ${segundos} segundos para cruzar la meta` : `Esperando a los demás: ${segundos} segundos`);
      if (modo === 'apurate' && segundos <= PITIDOS_S && segundos !== pitado) { pitado = segundos; pitido(segundos === 1); }
    }
    caja.hidden = false;
  }

  const bucle = () => { if (!vivo) return; actualizar(); requestAnimationFrame(bucle); };
  if (!manual) requestAnimationFrame(bucle);
  return {
    actualizar, listo, colocar,
    estado: () => ({ visible: !caja.hidden, modo, segundos: caja.hidden ? -1 : segundos, letrero: caja.hidden ? '' : letrero,
                     texto: caja.hidden ? '' : `${segundos} ${letrero}`, fuente: fuentes ? 'juego' : 'reserva', fuenteNumero,
                     animacion: numero.classList.contains('golpe') ? 'golpe' : numero.classList.contains('tic') ? 'tic' : '' }),
    detener() { vivo = false; documento.defaultView?.removeEventListener('resize', alCambiarTamaño); caja.remove(); },
  };
}
