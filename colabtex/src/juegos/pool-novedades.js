/* El registro de cambios de Pool 8, para el menú del juego. Lo más nuevo
   va primero. Cada versión: `v`, `fecha`, `titulo` y `grupos`, que son
   [encabezado, [líneas]]. Al publicar una versión, súmala arriba y sube
   `VERSION_POOL`: el menú muestra ese número. */
import { RAREZAS, PRECIO_COFRE, IDS_PREMIO } from "./tacos.js";

export const VERSION_POOL = "0.1";

const pct = n => (n / 10).toLocaleString("es-CL") + " %";

export const NOVEDADES_POOL = [
  {
    v: "0.1", fecha: "2026-10-20", titulo: "Primera versión",
    grupos: [
      ["El juego", [
        "Billar a ocho bolas con las reglas tradicionales: rotura legal, mesa abierta, lisas y rayadas, faltas con blanca en mano y la 8 cantada.",
        "Física propia y determinista: todos los jugadores ven exactamente la misma mesa, bola por bola.",
        "Fuerza del golpe variable, de una caricia a un tiro de rotura.",
        "Punto de golpe en la blanca: efecto alto (sigue), bajo (retrocede) y lateral (se nota en las bandas).",
        "Bolas con volumen: la raya gira y el número se mueve mientras ruedan."
      ]],
      ["Formatos y ayudas", [
        "1 contra 1 y 2 contra 2 al crear la sala; en parejas eliges quién será tu compañero.",
        "Modo con línea guía (bola fantasma y salida de las bolas, en rojo si el primer contacto sería ilegal) o sin ella.",
        "Controles con ratón, táctil o teclado: flechas para apuntar, arriba y abajo para la fuerza, Espacio para golpear."
      ]],
      ["Tacos y cofres", [
        `${IDS_PREMIO.length + 1} tacos de cinco rarezas, de la madera lisa del taco de escuela hasta el Excalibur y la Galaxia, con brillos animados.`,
        `Cofres de tacos a ${PRECIO_COFRE} monedas cada uno, con las monedas de la página.`,
        "Probabilidades: " + RAREZAS.map(r => `${r.nombre} ${pct(r.mil)}`).join(" · ") + ".",
        "Un taco repetido devuelve monedas según su rareza.",
        "El taco que equipas lo ven tus rivales en la mesa."
      ]],
      ["En el resto de la página", [
        "Seis logros nuevos de Pool, con monedas.",
        "Marco de campeón «Bola ocho» para el perfil.",
        "Manual de reglas con ejemplos ilustrados, efectos de sonido propios y portada en el vestíbulo."
      ]]
    ]
  }
];
