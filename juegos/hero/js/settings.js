// Ajustes persistentes (localStorage) y perfiles de controles.
const KEY = 'proyecto-hero-settings-v1';

export const GUITAR_ACTIONS = [
  ['g0', 'Traste verde'], ['g1', 'Traste rojo'], ['g2', 'Traste amarillo'], ['g3', 'Traste azul'], ['g4', 'Traste naranja'],
  ['up', 'Rasgueo arriba'], ['down', 'Rasgueo abajo'], ['sp', 'Star Power'], ['whammy', 'Whammy'], ['start', 'Pausa'],
];
export const DRUM_ACTIONS = [
  ['kick', 'Bombo'], ['p0', 'Rojo'], ['p1', 'Amarillo'], ['p2', 'Azul'], ['p3', 'Verde (4) / Naranja (5)'], ['p4', 'Verde (5 carriles)'],
  ['c1', 'Platillo amarillo (pro)'], ['c2', 'Platillo azul (pro)'], ['c3', 'Platillo verde (pro)'], ['sp', 'Star Power'], ['start', 'Pausa'],
];

function keyboardProfile(id, name, guitar, drums) {
  return { id, name, device: 'keyboard', guitar, drums };
}

function gamepadProfile(index) {
  return {
    id: `gp${index}`,
    name: `Mando ${index + 1}`,
    device: `gamepad:${index}`,
    // Mapeo de guitarra Xbox 360 / mando estándar
    guitar: { g0: ['b0'], g1: ['b1'], g2: ['b3'], g3: ['b2'], g4: ['b4'], up: ['b12'], down: ['b13'], sp: ['b8', 'b5'], whammy: ['a2+', 'a3+'], start: ['b9'] },
    drums: { kick: ['b4', 'b6'], p0: ['b1'], p1: ['b3'], p2: ['b2'], p3: ['b0'], p4: ['b5'], c1: [], c2: [], c3: [], sp: ['b8'], start: ['b9'] },
  };
}

// velocidad de notas, ventana de acierto y tamaño de gemas: siempre los valores por defecto
const FIXED = ['noteSpeed', 'hitWindow', 'highwayTilt'];

export const DEFAULT_SETTINGS = {
  playerName: '',
  noteMode: 'taps', // taps | normal | hopos | strums
  showKeyLabels: true,
  missSound: true,
  highwayStyle: 'wood', // wood | dark
  screenShake: true,
  noteSpeed: 1.0,
  audioOffset: 0, // ms (positivo = las notas llegan más tarde)
  videoOffset: 0,
  hitWindow: 70,
  lefty: false,
  muteOnMiss: true,
  showVideo: true,
  showBackground: true,
  expertPlus: false,
  proCymbals: false,
  highwayTilt: 1.0,
  // para PCs lentos: menos resolución y efectos más sencillos (render/highway.js)
  altoRendimiento: false,
  // Batalla de Rock de fondo mientras tocas (sitio/rock.js)
  fondoRock: true,
  volume: { master: 0.85, song: 1, instrument: 1, sfx: 0.5, preview: 0.5 },
  profiles: [
    keyboardProfile('kb1', 'Teclado 1',
      { g0: ['KeyA'], g1: ['KeyS'], g2: ['KeyD'], g3: ['KeyF'], g4: ['KeyG'], up: ['ArrowUp'], down: ['ArrowDown', 'Enter'], sp: ['Space', 'ShiftRight'], whammy: ['ControlRight'], start: ['Escape'] },
      { kick: ['Space'], p0: ['KeyD'], p1: ['KeyF'], p2: ['KeyJ'], p3: ['KeyK'], p4: ['KeyL'], c1: ['KeyR'], c2: ['KeyU'], c3: ['KeyI'], sp: ['Enter'], start: ['Escape'] }),
    keyboardProfile('kb2', 'Teclado 2',
      { g0: ['KeyH'], g1: ['KeyJ'], g2: ['KeyK'], g3: ['KeyL'], g4: ['Semicolon'], up: ['KeyN'], down: ['KeyM'], sp: ['KeyB'], whammy: ['Comma'], start: ['Backspace'] },
      { kick: ['KeyB'], p0: ['KeyH'], p1: ['KeyJ'], p2: ['KeyK'], p3: ['KeyL'], p4: ['Semicolon'], c1: [], c2: [], c3: [], sp: ['KeyN'], start: ['Backspace'] }),
    gamepadProfile(0), gamepadProfile(1), gamepadProfile(2), gamepadProfile(3),
  ],
};

function merge(def, val) {
  if (Array.isArray(def)) return Array.isArray(val) ? val : def;
  if (def && typeof def === 'object') {
    const out = {};
    for (const k of Object.keys(def)) out[k] = merge(def[k], val?.[k]);
    return out;
  }
  return val === undefined || val === null || typeof val !== typeof def ? def : val;
}

export const settings = (() => {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY));
  } catch {}
  const s = merge(structuredClone(DEFAULT_SETTINGS), saved || {});
  // perfiles: conserva los guardados por id
  s.profiles = DEFAULT_SETTINGS.profiles.map((p) => merge(structuredClone(p), saved?.profiles?.find((q) => q.id === p.id) || {}));
  // fijos (ya no se pueden cambiar): si quedó un valor guardado de antes, se ignora
  for (const k of FIXED) s[k] = DEFAULT_SETTINGS[k];
  return s;
})();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
}

export function resetProfile(id) {
  const def = DEFAULT_SETTINGS.profiles.find((p) => p.id === id);
  const i = settings.profiles.findIndex((p) => p.id === id);
  if (def && i >= 0) settings.profiles[i] = structuredClone(def);
  saveSettings();
}

export function profileById(id) {
  return settings.profiles.find((p) => p.id === id);
}
