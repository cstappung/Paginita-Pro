/* Pokelike — lo que dicen los jefes y cómo se ven las medallas. Solo
   presentación: el motor no lo usa. Las medallas son dibujos propios en SVG
   (viewBox 0 0 100 100), inspirados en las de Kanto, en el orden de
   TRAMOS: Roca, Cascada, Trueno, Arcoíris, Alma, Pantano, Volcán, Tierra. */
(() => {
  'use strict';

  const DIALOGOS = {
    Brock: {
      antes: ['¿Un entrenador nuevo? Soy Brock, líder del Gimnasio Plateada.', 'Mis Pokémon son duros como la roca. ¡A ver si los puedes mover!'],
      despues: '¡Me ganaste limpio! Llévate la Medalla Roca, te la ganaste.',
    },
    Misty: {
      antes: ['Soy Misty, y mi estrategia con los Pokémon de agua es una sola…', '¡Ataque total! ¿Listo para mojarte?'],
      despues: '¡Uf, eres bueno! Está bien, toma la Medalla Cascada.',
    },
    'Teniente Surge': {
      antes: ['¡Hey, recluta! Soy el Teniente Surge.', 'Mis Pokémon eléctricos me salvaron en la guerra. ¡Contigo no va a ser distinto!'],
      despues: '¡Wow! Eres un rayo, recluta. La Medalla Trueno es tuya.',
    },
    Erika: {
      antes: ['Bienvenido a mi jardín. Soy Erika y amo a los Pokémon planta.', 'No subestimes la fuerza de una flor.'],
      despues: 'Perdí… Eres muy fuerte. Por favor, acepta la Medalla Arcoíris.',
    },
    Koga: {
      antes: ['Je, je… Soy Koga, maestro ninja del veneno.', 'Mis técnicas te van a confundir hasta que caigas.'],
      despues: '¡Hmm! Demostraste tu valía. Toma la Medalla Alma.',
    },
    Sabrina: {
      antes: ['Sabía que vendrías. Lo vi hace tres años.', 'Mis poderes psíquicos ya conocen el final de este combate.'],
      despues: 'Esto no lo vi venir… Toma la Medalla Pantano.',
    },
    Blaine: {
      antes: ['¡Ja! Soy Blaine, el ardiente líder de Isla Canela.', '¡Mis Pokémon de fuego te van a chamuscar! ¿Trajiste antiquemar?'],
      despues: '¡Me apagaste por completo! La Medalla Volcán es tuya.',
    },
    Giovanni: {
      antes: ['Así que llegaste hasta aquí. Soy Giovanni.', 'Este gimnasio es mi territorio. Prepárate para perderlo todo.'],
      despues: 'Ja… Esta vez ganaste tú. Toma la Medalla Tierra, la última.',
    },
    Lorelei: {
      antes: ['Bienvenido a la Liga Pokémon. Soy Lorelei, del Alto Mando.', 'Nadie aguanta mis Pokémon de hielo. ¡Te voy a congelar!'],
      despues: '¡No puede ser! Me derritieron… Sigue, el resto del Alto Mando te espera.',
    },
    Bruno: {
      antes: ['Soy Bruno, del Alto Mando. Entreno cuerpo y mente con mis Pokémon.', '¡Hoo, haah! ¡Que empiece la pelea!'],
      despues: '¿Cómo es posible? Mi entrenamiento no bastó. ¡Adelante, te lo ganaste!',
    },
    Agatha: {
      antes: ['Soy Agatha, del Alto Mando. Los fantasmas son mis compañeros.', 'Te voy a enseñar cómo pelea una entrenadora de verdad.'],
      despues: 'Je… Eres especial, chico. Ve, Lance te espera.',
    },
    Lance: {
      antes: ['Te estaba esperando. Soy Lance, el último del Alto Mando.', 'Los dragones son legendarios y casi invencibles. ¿Te atreves?'],
      despues: 'Increíble… Venciste a mis dragones. Ya eres digno de enfrentar al Campeón.',
    },
    Azul: {
      antes: ['¡Por fin llegas! Mientras tú entrenabas, yo me hice Campeón.', '¡Ahora te voy a demostrar quién es el mejor entrenador del mundo!'],
      despues: '¿Perdí…? Mi reinado duró tan poco… Felicidades, eres el nuevo Campeón.',
    },
  };

  const BORDE = 'stroke="#e6e9ee" stroke-width="4" stroke-linejoin="round"';
  const BRILLO = '<path d="M28 22 Q40 14 54 18" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>';
  const petalos = (n, r, colores, w, cy = 50) => Array.from({ length: n }, (_, k) => {
    const a = k * 360 / n;
    return `<ellipse cx="50" cy="${cy - r}" rx="${w}" ry="${w * 1.15}" fill="${colores[k % colores.length]}" ${BORDE.replace('4', '3')} transform="rotate(${a} 50 ${cy})"/>`;
  }).join('');

  const FORMAS = [
    // Roca: gema octogonal gris
    `<polygon points="31,6 69,6 94,31 94,69 69,94 31,94 6,69 6,31" fill="#8e949c" ${BORDE}/>
     <polygon points="38,24 62,24 76,38 76,62 62,76 38,76 24,62 24,38" fill="#a9afb7" stroke="#6c727a" stroke-width="3"/>
     <path d="M31 6 38 24 M69 6 62 24 M94 31 76 38 M94 69 76 62 M69 94 62 76 M31 94 38 76 M6 69 24 62 M6 31 24 38" stroke="#6c727a" stroke-width="3"/>`,
    // Cascada: gota azul
    `<path d="M50 4 C66 30 84 48 84 66 A34 34 0 0 1 16 66 C16 48 34 30 50 4 Z" fill="#4fb3e8" ${BORDE}/>`,
    // Trueno: flor de pétalos amarillos con centro café
    `${petalos(8, 30, ['#f2c94c', '#e9b830'], 13)}<circle cx="50" cy="50" r="19" fill="#7a3b1e" ${BORDE.replace('4', '3')}/>
     <circle cx="50" cy="50" r="10" fill="#9c5530"/>`,
    // Arcoíris: flor de pétalos de colores con centro blanco
    `${petalos(8, 30, ['#e8506a', '#f39c34', '#f2d74c', '#7ac74c', '#3fb6a8', '#4f86e8', '#8f62d6', '#e07ab8'], 13)}
     <circle cx="50" cy="50" r="17" fill="#fafafa" ${BORDE.replace('4', '3')}/><rect x="43" y="43" width="14" height="14" fill="#c9ccd2" transform="rotate(45 50 50)"/>`,
    // Alma: corazón rosa partido
    `<path d="M50 90 C18 68 6 50 6 32 A22 22 0 0 1 50 22 A22 22 0 0 1 94 32 C94 50 82 68 50 90 Z" fill="#ec5a8c" ${BORDE}/>
     <path d="M50 22 L44 50 L56 62 L50 90" fill="none" stroke="#e6e9ee" stroke-width="3"/>`,
    // Pantano: disco dorado con un anillo
    `<circle cx="50" cy="50" r="44" fill="#f1c232" ${BORDE}/><circle cx="50" cy="50" r="27" fill="none" stroke="#c99a12" stroke-width="5"/>`,
    // Volcán: llama roja con un rombo
    `<path d="M50 4 C58 20 66 22 74 14 C82 34 92 46 90 64 A40 32 0 0 1 10 64 C8 46 18 34 26 14 C34 22 42 20 50 4 Z" fill="#d73a2c" ${BORDE}/>
     <polygon points="50,38 62,56 50,74 38,56" fill="#f6d45a" stroke="#e6e9ee" stroke-width="3"/>`,
    // Tierra: copa de hojas verde sobre un tronco
    `<rect x="44" y="52" width="12" height="42" rx="5" fill="#7cc14a" ${BORDE.replace('4', '3')}/>
     <path d="M50 6 C66 6 70 16 80 20 C90 26 88 40 82 46 C80 58 66 62 56 56 L50 60 L44 56 C34 62 20 58 18 46 C12 40 10 26 20 20 C30 16 34 6 50 6 Z" fill="#4f9d3a" ${BORDE}/>
     <path d="M50 14 V52 M50 30 L66 22 M50 30 L34 22 M50 42 L70 36 M50 42 L30 36" stroke="#2f6e22" stroke-width="3" fill="none"/>`,
  ];

  const cuerpo = i => FORMAS[i] + (i === 2 || i === 3 ? '' : BRILLO);
  const svg = (i, clase = '') =>
    `<svg class="badge ${clase}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${cuerpo(i)}</svg>`;

  window.PokelikeMedallas = { DIALOGOS, svg, cuerpo, N: FORMAS.length };
})();
