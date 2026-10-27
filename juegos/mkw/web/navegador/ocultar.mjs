// Esconder botones de los menús del juego que en la web no sirven — bitácora §66.
//
// Resumen: Mario Kart Wii arma cada pantalla de sus menús como una "página" con controles (marcos, botones). Cada
// control tiene un byte "escondido" (+0x80: 1 = no se dibuja) y cada botón dice qué jugadores pueden elegirlo (bits;
// 0 = nadie). Cuando una página se pone al frente, el juego avisa (web/juego/paginas_nativo.cpp →
// Module.mkwAlActivarPagina) y aquí, según la pantalla, se esconde lo que no corresponde:
//   - menú principal: el recuadro «Retro WFC» y sus botones (1 y 2 jugadores). En línea se juega SOLO desde la sala
//     de Juegos (decisión del dueño): ahí la página entra sola a «VS mundial» y este recuadro se deja;
//   - «Un jugador»: el botón «Settings» de Retro Rewind (sus ajustes; pedido del dueño, §66).
// Como un interruptor que corta la alimentación de un piloto luminoso y además desconecta el pulsador: no se ve y
// apretarlo no hace nada.
//
// Lo que se sabe de la memoria del juego (RMCP01 + Retro Rewind 6, medido con el banco en §66; los nombres salen del
// MAP de WiiCompiled: PushButton::__ct, PushButton::SetPlayerBitfield, Page::Activate):
//   página:  +0x04 su número (0x5A menú principal, 0x69 un jugador) · +0x658 su "administrador de mandos"
//   botón:   +0x00 vtable (dice de qué clase es) · +0x80 escondido · +0x234 apunta al administrador de su página ·
//            +0x240 su número dentro de la página · +0x244 y +0x1E4 (= +0x174+0x70) quién puede elegirlo
//   menú principal: el recuadro «Retro WFC» es un control de la misma página, en +0x9AC (vtable 0x808BEFB4);
//            sus botones son de la clase 0x808D35A8 con número 4 (1 jugador) y 5 (2 jugadores)
//   un jugador: «Settings» es un PushButton (vtable 0x808B776C) con número 5
// Antes de escribir se revisa que cada cosa tenga exactamente esa forma (clase, número, administrador); si el juego
// cambiara (otra versión de Retro Rewind), no se toca nada.
//
// Uso (mkw.mjs):  const ocultar = crearOcultar({ lector: window.mkwMenus, enLinea });
//                 M.mkwAlActivarPagina = dir => ocultar.alActivar(dir);   ocultar.estado → qué escondió

export const PAGINA = { menuPrincipal: 0x5A, unJugador: 0x69 };
export const CLASE = { pushButton: 0x808B776C, botonVideo: 0x808D35A8, marcoMenu: 0x808BEFB4 };
const ESCONDIDO = 0x80, ADMIN = 0x658, BOTON_ADMIN = 0x234, BOTON_ID = 0x240, BITS = 0x244, BITS_MANDO = 0x1E4;

// Qué esconder en cada pantalla. cuando(opciones) = si la regla vale (p. ej. no en la sala en línea)
export const REGLAS = [
  { pagina: PAGINA.menuPrincipal, que: 'Retro WFC', cuando: o => !o.enLinea,
    marcos: [{ en: 0x9AC, clase: CLASE.marcoMenu }],
    botones: [{ id: 4, clase: CLASE.botonVideo }, { id: 5, clase: CLASE.botonVideo }] },
  { pagina: PAGINA.unJugador, que: 'Settings de Retro Rewind',
    botones: [{ id: 5, clase: CLASE.pushButton }] },
];

export function crearOcultar({ lector, enLinea = false, alcance = 0x40000, reglas = REGLAS } = {}) {
  const estado = { activaciones: 0, escondidos: 0, ultima: null, porPagina: {} };

  // Los botones de una página: los objetos de la memoria que apuntan a SU administrador de mandos en +0x234 y tienen
  // una vtable en la zona de clases del juego. Algunos viven dentro de la página y otros en el montón (memoria que el
  // juego pide al armar la pantalla), cerca: se busca ±alcance alrededor de la página.
  function botonesDe(pag) {
    const admin = pag + ADMIN, lista = [];
    for (let d = Math.max(0x80000000, pag - alcance); d < pag + alcance; d += 4) {
      if (lector.u32(d + BOTON_ADMIN) !== admin) continue;
      const clase = lector.u32(d);
      if (clase < 0x80800000 || clase >= 0x80900000) continue;
      lista.push({ dir: d, clase, id: lector.u32(d + BOTON_ID) | 0 });
    }
    return lista;
  }
  function esconderBoton(dir) {
    lector.w8(dir + ESCONDIDO, 1);
    lector.w32(dir + BITS, 0);           // lo mismo que PushButton::SetPlayerBitfield(0): nadie puede elegirlo
    lector.w32(dir + BITS_MANDO, 0);
  }

  function alActivar(pag) {
    estado.activaciones++;
    const numero = lector.u32(pag + 4) | 0;
    const aplican = reglas.filter(r => r.pagina === numero && (!r.cuando || r.cuando({ enLinea })));
    if (!aplican.length) return 0;
    let botones = null, n = 0;
    const hecho = [];
    for (const r of aplican) {
      for (const m of r.marcos || []) {
        if (lector.u32(pag + m.en) !== m.clase) continue;   // no tiene la forma esperada: no se toca
        lector.w8(pag + m.en + ESCONDIDO, 1); n++;
      }
      if (r.botones) {
        botones ||= botonesDe(pag);
        for (const b of r.botones) {
          const x = botones.find(y => y.id === b.id && y.clase === b.clase);
          if (x) { esconderBoton(x.dir); n++; }
        }
      }
      hecho.push(r.que);
    }
    estado.escondidos += n;
    estado.ultima = { pagina: numero, escondidos: n, que: hecho };
    estado.porPagina[numero] = (estado.porPagina[numero] || 0) + n;
    return n;
  }

  return { estado, alActivar, botonesDe };
}
