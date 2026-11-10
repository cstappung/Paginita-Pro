// La «disposición» de un mando que el navegador no reconoce: dónde está cada botón — bitácora §263 (el dueño: «agrega
// compatibilidad con mando switch y switch 2» y «mandos genericos»).
//
// Resumen: el navegador numera los botones de un mando conocido siempre igual (el mapeo «standard»: 0 = el de abajo,
// 1 = el de la derecha… 12-15 la cruz; ejes 0/1 el stick izquierdo, 2/3 el derecho). Un mando que no conoce (un genérico
// barato, el de Switch 2 por cable) llega con mapping "" y los botones en cualquier orden. Una DISPOSICIÓN dice, para cada
// lugar del mando estándar, qué entrada de ESE mando es: { b0: 'b2', b12: 'a9~-1', 'a1-': 'a1+', … }.
// Con ella, estandarizar(g, disp) arma un mando «standard» de mentira a partir del de verdad (cada lugar = valorFuente
// de su entrada, la misma cuenta del resto de los mandos), y desde ahí todo sigue igual: el mapa por omisión, la
// disposición por letra, el dibujo del mando, la reasignación y la zona muerta.
//   · Las conocidas vienen escritas aquí (el Pro Controller de Switch 2 y el de GameCube de Switch 2, medidos por otros
//     con Chrome: mapping "", los botones en el orden de los bits de su informe, el eje Y al revés y el recorrido hasta
//     ~0,8). Las demás las arma la persona con «Enséñale tu mando»: el dibujo marca cada lugar y ella aprieta el suyo.
// Como la tabla de bornes de un equipo de otra marca: los cables son los mismos, cambia en qué borne entra cada uno;
// con la tabla, el resto de la instalación no se entera.
//
// Uso:  disposicionDe(perfil, guardadas)  → la disposición (guardada o conocida) o null
//       estandarizar(g, disp, { centro })  → un objeto con forma de Gamepad «standard» (buttons, axes, id, index…)
//       PASOS                              → los lugares que recorre «Enséñale tu mando», en orden

import { valorFuente, fuenteValida } from './asignacion-mando.mjs';

// Los lugares del mando estándar, en el orden en que los pide «Enséñale tu mando» (lugar, cómo se lo nombra)
export const PASOS = [
  ['b0', 'el botón de ABAJO de los cuatro de la derecha'], ['b1', 'el botón de la DERECHA de los cuatro'],
  ['b2', 'el botón de la IZQUIERDA de los cuatro'], ['b3', 'el botón de ARRIBA de los cuatro'],
  ['b4', 'el botón de hombro IZQUIERDO (L / LB)'], ['b5', 'el botón de hombro DERECHO (R / RB)'],
  ['b6', 'el gatillo IZQUIERDO (ZL / LT)'], ['b7', 'el gatillo DERECHO (ZR / RT)'],
  ['b8', 'Select / − / View'], ['b9', 'Start / + / Menu'],
  ['b12', 'la cruz ARRIBA'], ['b13', 'la cruz ABAJO'], ['b14', 'la cruz IZQUIERDA'], ['b15', 'la cruz DERECHA'],
  ['a0-', 'el stick izquierdo hacia la IZQUIERDA'], ['a0+', 'el stick izquierdo hacia la DERECHA'],
  ['a1-', 'el stick izquierdo hacia ARRIBA'], ['a1+', 'el stick izquierdo hacia ABAJO'],
  ['a2-', 'el stick derecho hacia la IZQUIERDA'], ['a2+', 'el stick derecho hacia la DERECHA'],
  ['a3-', 'el stick derecho hacia ARRIBA'], ['a3+', 'el stick derecho hacia ABAJO'],
];
export const LUGARES = new Set(PASOS.map(([l]) => l));

// Las conocidas. El Pro Controller de Switch 2 (057e:2069) por cable, ya despierto (switch2.mjs): 21 botones en el orden
// de los bits de su informe —0 B, 1 A, 2 Y, 3 X, 4 R, 5 ZR, 6 +, 7 stick der., 8 ↓, 9 →, 10 ←, 11 ↑, 12 L, 13 ZL, 14 −,
// 15 stick izq., 16 Home, 17 Captura— y 6 ejes [X, Y, —, Rx, —, Rz] con +Y hacia ARRIBA y el tope en ~0,8.
// El de GameCube de Switch 2 (057e:2073): el mismo orden de bits en lo que tiene en común (A, B, X, Y, R, Z, Start, la
// cruz, L), según el programa que lo despierta en Linux; sin probar con el mando de verdad en Chrome: si algo no calza,
// «Enséñale tu mando» lo corrige y su disposición guardada gana.
const SWITCH2 = {
  b0: 'b0', b1: 'b1', b2: 'b2', b3: 'b3', b4: 'b12', b5: 'b4', b6: 'b13', b7: 'b5', b8: 'b14', b9: 'b6',
  b10: 'b15', b11: 'b7', b12: 'b11', b13: 'b8', b14: 'b10', b15: 'b9', b16: 'b16',
  'a0-': 'a0-', 'a0+': 'a0+', 'a1-': 'a1+', 'a1+': 'a1-', 'a2-': 'a3-', 'a2+': 'a3+', 'a3-': 'a5+', 'a3+': 'a5-',
  escala: 0.8, centrar: true, nombre: 'Pro Controller de Switch 2',
};
export const CONOCIDAS = {
  '057e:2069·libre': SWITCH2,
  // (el de GameCube: la A grande en el lugar de «aceptar» —abajo— y la B en el de «volver», X a la izquierda, Y arriba,
  // como en la Wii; el gatillo R = derrapar (RT), L = objeto (LT), Z = Z (RB), ZL = objeto también (LB))
  '057e:2073·libre': { ...SWITCH2, b0: 'b1', b1: 'b0', b2: 'b3', b3: 'b2', b4: 'b13', b5: 'b5', b6: 'b12', b7: 'b4',
                       nombre: 'Mando de GameCube de Switch 2', probada: false },
};
export const NOMBRES_SWITCH2 = { '2066': 'Joy-Con 2 (der.)', '2067': 'Joy-Con 2 (izq.)', '2069': 'Pro Controller de Switch 2', '2073': 'Mando de GameCube de Switch 2' };

// La disposición de un mando: la que enseñó la persona (gana) o la conocida, o null (mando estándar o sin enseñar)
export function disposicionDe(perfil, guardadas = {}) {
  const d = guardadas?.[perfil];
  if (d && typeof d === 'object' && Object.keys(d).some(k => LUGARES.has(k))) return d;
  return CONOCIDAS[perfil] || null;
}
// Revisar una disposición enseñada (lo que viene de localStorage): solo lugares y fuentes válidos
export function revisarDisposicion(d) {
  const r = {};
  for (const [l] of PASOS) if (fuenteValida(d?.[l])) r[l] = d[l];
  if (Number.isFinite(d?.escala) && d.escala > 0.3 && d.escala <= 1) r.escala = d.escala;
  return r;
}

// El mando «standard» de mentira. centro = { [eje]: reposo } (lo mide quien llama la primera vez: ver medirCentro)
export function estandarizar(g, disp, { centro = null } = {}) {
  if (!g || !disp) return g;
  const escala = disp.escala || 1;
  const fijo = f => (centro && /^a\d+[+-]$/.test(f) && Number.isFinite(centro[+f.slice(1, -1)]) ? `${f}@${centro[+f.slice(1, -1)]}` : f);
  const v = lugar => { const f = disp[lugar]; if (!f) return 0; const x = valorFuente(g, disp.centrar ? fijo(f) : f); return /^a/.test(f) ? Math.min(1, x / escala) : x; };
  const buttons = [];
  for (let i = 0; i < 17; i++) { const x = v('b' + i); buttons.push({ pressed: x > 0.5, touched: x > 0.5, value: x }); }
  const axes = [0, 1, 2, 3].map(k => Math.max(-1, Math.min(1, v(`a${k}+`) - v(`a${k}-`))));
  return { id: g.id, index: g.index, connected: g.connected !== false, mapping: 'standard', timestamp: g.timestamp, buttons, axes,
           vibrationActuator: g.vibrationActuator || null, crudo: g };
}
// El reposo de cada eje (para los sticks que no descansan en 0: el de Switch 2 marca +0,1): redondeado a centésimas;
// solo los que están cerca del centro (un gatillo que descansa en −1 se deja: ya lo resuelve su «@»)
export function medirCentro(g) {
  const c = {};
  (g?.axes || []).forEach((x, i) => { if (Number.isFinite(x) && Math.abs(x) < 0.3) c[i] = Math.round(x * 100) / 100; });
  return c;
}
// Lo que aprendió «Enséñale tu mando» → la disposición (lugar → fuente; lo que se saltó queda sin nada)
export function armarDisposicion(respuestas) {
  const d = {};
  for (const [l] of PASOS) if (fuenteValida(respuestas?.[l])) d[l] = respuestas[l];
  return d;
}
