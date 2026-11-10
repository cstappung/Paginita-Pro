// El principio de los videos de los menús, bajado de antemano (D8 del plan de rendimiento, bitácora §174).
//
// Resumen: los menús muestran videos THP (el del botón elegido, el de la cilindrada, el de las copas…) que el juego lee
// MIENTRAS los reproduce: unos 52 Mbit/s en `cup_select`. No van en la semilla de bloques (pesan 9–45 MB cada uno y solo
// se ve el principio) y la lectura seguida del disco los adelanta recién cuando el juego empieza a leerlos: en la 1.ª
// visita el primer pedazo de cada video se espera a la red (un tirón al abrir cada pantalla) y el adelanto arranca de
// atrás. Esto baja de fondo los primeros `cabeza` bytes (2 MB, ~0,3 s de video) de cada video de los menús apenas el
// juego empieza a mostrar el primero (el del título: ya terminó de arrancar). Es como cargar el condensador de entrada
// antes de conectar la carga: el video arranca sin caída y la lectura seguida tiene margen para alcanzar.
// Con prioridad normal de fondo (no urgente: lo que el juego espera pasa primero); nada en la carrera.
//
// Uso:  const v = crearVideosMenu({ disco, tamaños, direccion, cabeza, nota });
//       v.alLeer(ruta) en cada lectura del juego (anotarLectura de mkw.mjs); v.estado = { disparo, pedidos: [[ruta, bytes]] }
//       ?videosCabeza=MB (0 = sin esto, como antes)

// Los videos que se ven en los menús, en el orden en que suelen aparecer (medido con medir-carrera-entera.mjs --menu:
// tu2d-*, las lecturas «antes» de largar). El del título (top_menu) no: cuando se lee el primero, ya está en camino.
export const VIDEOS_MENU = [
  '/mkw/disco/files/thp/button/single_top.thp',
  '/mkw/sd/RetroRewind6/UI/class.thp',
  '/mkw/sd/RetroRewind6/UI/transmissionType.thp',
  '/mkw/disco/files/thp/button/drift_select.thp',
  '/mkw/disco/files/thp/course/cup_select.thp',
  '/mkw/disco/files/thp/button/indiv_team.thp',
  '/mkw/disco/files/thp/battle/battle_select.thp',
];

// Qué pedir (puro): [[ruta, tamaño, bytes]] de los videos que existen, sin `salvo` (el que el juego ya está leyendo)
export function cabezasDeVideos(existe, cabeza, salvo = null) {
  const lista = [];
  if (!(cabeza > 0)) return lista;
  for (const ruta of VIDEOS_MENU) {
    const tam = existe(ruta);
    if (ruta === salvo || !(tam > 0)) continue;
    lista.push([ruta, tam, Math.min(tam, cabeza)]);
  }
  return lista;
}

export function crearVideosMenu({ disco, tamaños, direccion, cabeza = 2 * 1048576, nota = () => {}, enCarrera = () => false }) {
  const estado = { disparo: null, pedidos: [], cabeza };
  let hecho = false;
  function alLeer(ruta) {
    if (hecho || !ruta.endsWith('.thp') || !(cabeza > 0) || enCarrera()) return;
    hecho = true;                     // (una vez por visita: la caché del disco se queda con lo bajado)
    estado.disparo = { ruta, t: Math.round(performance.now()) };
    for (const [r, tam, bytes] of cabezasDeVideos(x => tamaños.get(x), cabeza, ruta)) {
      disco.adelantarRango(direccion(r), tam, 0, bytes);
      estado.pedidos.push([r, bytes]);
    }
    const mb = estado.pedidos.reduce((a, [, b]) => a + b, 0) / 1048576;
    nota(`videos de los menús: el juego abrió ${ruta.replace(/.*\//, '')}; adelanto el principio de ${estado.pedidos.length} videos (${mb.toFixed(1)} MB, de fondo)`);
  }
  return { estado, alLeer };
}
