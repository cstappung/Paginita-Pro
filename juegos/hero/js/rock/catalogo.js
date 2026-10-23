// Batalla de Rock — el catálogo, puro (sin DOM ni three.js).
//
// Lo comparten tres sitios: la escena 3D del juego (./escena.js, el editor
// y el fondo de PRO HERO), la página de Juegos (esbuild lo mete en el
// paquete: la economía, el mercado y el cartero de PRO HERO) y las pruebas
// de Node. Por eso no importa nada.
//
// Lo que vale dinero sale de aquí: qué trae cada caja (`POOL`, solo se
// agrega al final), sus colores al azar (`coloresDe`) y lo que trae toda
// cuenta de partida (`iniciales`). La caja la deriva la página con la hora
// del servidor (colabtex/src/juegos/rock-datos.js); aquí solo está el
// reparto, con un azar que se le pasa.

const hexK = (hex, k) => {
  const c = Number(hex) >>> 0, f = x => Math.max(0, Math.min(255, Math.round(x * k)));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
};
export const shade = hexK;

/* Cada personaje = cuerpo base + piel + cara + peinado + barba + ropa + accesorios + guitarra */
export const ROCKERS = {
  violeta: {
    name: 'Violeta Voltaje', ui: '#c07bff', body: 'f', skin: 0xf3c9a4,
    face: { eyeShape: 'grandes', mkStyle: 'ahumado', mkColor: 0x8a3ee6, eyes: 0x6a3aa8, lipColor: 0xc8355f, brow: 0x4a1f80, shadow: 0x8a3ee6, eyeSize: 1.16, faceW: 0.9, lashLen: 1.55, makeup: 1.3, browThick: 0.95 },
    hair: { style: 'pigtails', color: 0x7d3fd0, color2: 0x9a5cf0, accent: 0xff9a1a, ribbon: 0x42d64a },
    top: { type: 'jacket', color: 0x9a4fdc, accent: 0xf4ecff, bow: 0x1a1030, buttons: 0xff7ac8 },
    bottom: { type: 'skirt', color: 0x5e2496 }, belt: 0x54d43a,
    legwear: { type: 'stockings', a: '#62e83c', b: '#2a9a2a', ruffle: 0x8af06a },
    shoes: { type: 'platform', color: 0x8b2fd0 },
    acc: { wrist: 0xff7ac8, gloves: 0x241a30 }, nails: 0x3a1660,
    guitar: { type: 'offset', body: 0x8e3fe6, guard: 0xe6e0cc, head: 0x8e3fe6, knob: 0xf6f1df },
  },
  rex: {
    name: 'Rex Rugido', ui: '#ff7a3a', body: 'm', skin: 0xdca27a,
    face: { eyes: 0x3a2a18, brow: 0x4a2e14, nose: 1.12, jaw: 1.15, chin: 1.1 },
    hair: { style: 'long', color: 0x7a4e26, color2: 0xa8743c }, beard: { type: 'goatee', color: 0x5a3818 },
    top: { type: 'tank', color: 0x34343c }, bottom: { type: 'jeans', color: 0x4a5f86, rips: true },
    shoes: { type: 'boot', color: 0x1a1a1a },
    acc: { gloves: 0x2e2b33, warmers: ['#151515', '#3a3a3a'], studs: true, bulletBelt: true, chain: true, necklace: true, wrist: 0x161616 },
    build: { sw: 0.305, chest: 0.255, waist: 0.148, hip: 0.168, arm: 1.1 },
    guitar: { type: 'vee', body: 0xc0201a, guard: 0x111111, head: 0xc0201a, knob: 0x111111 },
  },
  kid: {
    name: 'Calavera Kid', ui: '#5dff5a', body: 'm', skin: 0xeab68e,
    face: { eyes: 0x2a6a3a, brow: 0x1a1a1a, nose: 0.95, jaw: 0.85, eyeSize: 1.05 },
    hair: { style: 'mohawk', color: 0x3cf03c, color2: 0x1fae2a },
    top: { type: 'leather', color: 0x1d1d24 }, bottom: { type: 'plaid' }, belt: 0x222222,
    shoes: { type: 'boot', color: 0x2a1c12 },
    acc: { studs: true, wrist: 0x111111, earring: true, chain: true },
    build: { sw: 0.272, chest: 0.222, waist: 0.138, hip: 0.16, arm: 0.98 },
    guitar: { type: 'sg', body: 0x141414, guard: 0xf2f2f2, head: 0x141414, knob: 0xd9a63a },
  },
};
/* ---------- EDITOR: catálogo separado por cuerpo — cada opción existe solo para hombre o solo para mujer ---------- */
export const ED_CAT = {
  m: {
    faceShape: [['cuadrada', 'Cuadrada'], ['ovalM', 'Ovalada'], ['alargada', 'Alargada'], ['redondaM', 'Redonda'], ['angulosa', 'Angulosa']],
    eyeShape: [['normales', 'Normales'], ['rasgados', 'Rasgados'], ['intensos', 'Intensos'], ['abiertos', 'Abiertos'], ['cansados', 'Cansados']],
    eyeStyle: [['clasico', 'Clásico'], ['felino', 'Felino'], ['anillo', 'Anillo de fuego'], ['hetero', 'Heterocromía'], ['fantasma', 'Fantasma'], ['rayo', 'Ojos de rayo', { eyes: 0x3aa8ff, eyes2: 0xffffff }], ['eclipse', 'Eclipse', { eyes: 0xff5a10, eyes2: 0xffd23a }], ['vortice', 'Vórtice hipnótico', { eyes: 0x8a2aff, eyes2: 0x3affd0 }]],
    browStyle: [['gruesas', 'Gruesas'], ['rectasM', 'Rectas'], ['pobladas', 'Pobladas'], ['cicatriz', 'Con cicatriz']],
    mkStyle: [['ninguno', 'Sin pintura'], ['delineado', 'Delineado'], ['corpse', 'Corpse paint'], ['guerra', 'Pintura de guerra'], ['ojeras', 'Ojeras de gira'], ['calaNeon', 'Calavera neón', { mkColor: 0x3affe0 }], ['runas', 'Runas de fuego', { mkColor: 0xff7a1a }], ['grietas', 'Grietas de lava', { mkColor: 0xff5a10 }]],
    hair: [['long', 'Melena'], ['mohawk', 'Cresta'], ['spiky', 'Puntas'], ['short', 'Corto'], ['bald', 'Rapado'], ['furia', 'Furia dorada', { color: 0xffbe1a, color2: 0xfff0a0 }], ['trueno', 'Cresta de trueno', { color: 0x1a3ad8, color2: 0x8ae8ff }], ['llamarada', 'Llamarada', { color: 0xff3a0a, color2: 0xffd040 }]],
    beard: [['none', 'Sin barba'], ['stubble', 'Tres días'], ['goatee', 'Perilla'], ['mustache', 'Bigote'], ['full', 'Barba completa'], ['barbaFuego', 'Barba de fuego', { color: 0xff4a10 }], ['escarcha', 'Barba de escarcha', { color: 0x8ad0ff }], ['barbaRayo', 'Barba eléctrica', { color: 0x2a6aff }]],
    top: [['tank', 'Musculosa'], ['tee', 'Polera'], ['leather', 'Chaqueta de cuero'], ['longsleeve', 'Manga larga'], ['infernal', 'Chaqueta infernal', { color: 0x1a0c08 }], ['cromo', 'Armadura cromada', { color: 0x8a92a6 }], ['neonTank', 'Musculosa de neón', { color: 0x0c0a16 }]],
    bottom: [['jeans', 'Jeans'], ['jeansRips', 'Jeans rotos'], ['leatherPants', 'Cuero'], ['plaid', 'Escocés'], ['shorts', 'Bermudas'], ['magma', 'Pantalón de magma', { color: 0x1c0f0a }], ['tormenta', 'Cuero tormenta', { color: 0x10142a }], ['jeansGalaxia', 'Jeans galácticos', { color: 0x1a1050 }]],
    legwear: [],
    shoes: [['boot', 'Bototos'], ['sneaker', 'Zapatillas'], ['chelsea', 'Botín chelsea'], ['botasInfierno', 'Botas infernales', { color: 0x1a0c08 }], ['botasCromo', 'Botas cromadas', { color: 0x9aa0b0 }], ['zapasNeon', 'Zapatillas de neón', { color: 0x0c0a16 }]],
    gloves: [['none', 'Sin guantes'], ['sinDedos', 'Sin dedos'], ['tachas', 'Con tachas'], ['completos', 'Completos'], ['tesla', 'Guantes tesla', { color: 0x10142a }], ['garrasMagma', 'Garras de magma', { color: 0x1a0c08 }], ['cosmicos', 'Guantes cósmicos', { color: 0x1a1050 }]],
    guitar: [['vee', 'Flying V'], ['sg', 'Doble cuerno'], ['explorer', 'Explorer'], ['hacha', 'Hacha infernal', { body: 0x1a0c08 }], ['rayoG', 'Relámpago', { body: 0x10184a }], ['llamaG', 'Llamarada', { body: 0x1a0805 }]],
    necklace: [['none', 'Ninguno'], ['colmillo', 'Colmillo'], ['placas', 'Placas militares'], ['pinchos', 'Collar de púas'], ['colmilloFuego', 'Colmillo de dragón', { color: 0xff6a1a }], ['amuleto', 'Amuleto del trueno', { color: 0x6ad8ff }], ['calaveraCr', 'Calavera cromada', { color: 0xff2a2a }]],
    earrings: [['none', 'Ninguno'], ['argolla', 'Argolla'], ['arete', 'Aretes'], ['cruz', 'Cruz colgante'], ['gemaSangre', 'Gema de sangre', { color: 0xff1a3a }], ['rayoArete', 'Rayo colgante', { color: 0x6ad8ff }], ['cruzFuego', 'Cruz de fuego', { color: 0x1a0805 }]],
    bracelets: [['none', 'Ninguna'], ['tachas', 'Tachas'], ['cuero', 'Muñequera'], ['cadena', 'Cadena'], ['magmaBr', 'Brazalete de magma', { color: 0x1a0c08 }], ['teslaBr', 'Bobina tesla', { color: 0x6ad8ff }], ['galaxiaBr', 'Brazal galáctico', { color: 0x1a1050 }]],
    tatDesign: [['calavera', 'Calavera'], ['llamas', 'Llamas'], ['tribal', 'Tribal'], ['serpiente', 'Serpiente'], ['dragon', 'Dragón de fuego', { color: 0xff5a1a }], ['fenix', 'Fénix', { color: 0xffa21a }], ['calaveraFuego', 'Calavera en llamas', { color: 0xff6a1a }]],
    tatSpot: [['brazoI', 'Brazo izq.'], ['brazoD', 'Brazo der.'], ['antebrazoI', 'Antebrazo izq.'], ['antebrazoD', 'Antebrazo der.'], ['pecho', 'Pecho'], ['espalda', 'Espalda'], ['cuello', 'Cuello'], ['manoI', 'Mano izq.'], ['manoD', 'Mano der.']],
    names: ['Dax Distorsión', 'Toni Trueno', 'Leo Látigo', 'Zack Zumbido', 'Iván Ícaro', 'Gus Gruñido', 'Mario Martillo'],
  },
  f: {
    faceShape: [['ovalF', 'Ovalada'], ['corazonF', 'Corazón'], ['redondaF', 'Redonda'], ['fina', 'Fina'], ['suave', 'Mandíbula suave']],
    eyeShape: [['grandes', 'Grandes'], ['almendra', 'Almendra'], ['gata', 'De gata'], ['redondos', 'Redondos']],
    eyeStyle: [['brillo', 'Brillo anime'], ['corazon', 'Pupila corazón'], ['estrella', 'Pupila estrella'], ['degradado', 'Degradado'], ['galaxia', 'Ojos galaxia', { eyes: 0x7a3ae8, eyes2: 0x2ad8ff }], ['latido', 'Corazón latiente', { eyes: 0xff4a9a, eyes2: 0xff2a6a }], ['prisma', 'Ojos prisma', { eyes: 0xff6ad8, eyes2: 0x6ae8ff }]],
    browStyle: [['arqueadas', 'Arqueadas'], ['finas', 'Finas'], ['rectasF', 'Rectas'], ['corte', 'Con corte']],
    mkStyle: [['ningunoF', 'Sin maquillaje'], ['natural', 'Natural'], ['ahumado', 'Ahumado'], ['gotico', 'Gótico'], ['glam', 'Glam brillante'], ['estrellaMk', 'Estrella'], ['cristales', 'Lágrimas de cristal', { mkColor: 0x9ae8ff }], ['aurora', 'Aurora boreal', { mkColor: 0x3affb0 }], ['mariposaMk', 'Alas de mariposa', { mkColor: 0xc07bff }]],
    hair: [['longF', 'Larga con flequillo'], ['pigtails', 'Coletas'], ['bob', 'Bob'], ['ponytail', 'Cola alta'], ['odango', 'Moños'], ['galaxiaH', 'Melena galáctica', { color: 0x6a2ab8, color2: 0x2ac8ff }], ['neonTw', 'Coletas neón', { color: 0xff3a9a, color2: 0x3ad8ff }], ['fenixH', 'Cola de fénix', { color: 0xff4a1a, color2: 0xffd23a }]],
    beard: [],
    top: [['jacket', 'Chaqueta con puños'], ['crop', 'Top corto'], ['corset', 'Corsé'], ['diamante', 'Corsé de diamantes', { color: 0xc8c0f0 }], ['holoTop', 'Top holográfico', { color: 0xe8e0ff }], ['chaquetaNeon', 'Chaqueta de neón', { color: 0x14101e, accent: 0xff3a9a }]],
    bottom: [['skirt', 'Falda tableada'], ['skirtPlaid', 'Falda escocesa'], ['mini', 'Minifalda de cuero'], ['pitillo', 'Pitillo con franja'], ['shortsF', 'Short tiro alto'], ['faldaGalaxia', 'Falda galaxia', { color: 0x6a2ab8 }], ['pitilloHolo', 'Pitillo holográfico', { color: 0xe0d8ff }], ['faldaFuego', 'Falda de fuego', { color: 0x2a0805 }]],
    legwear: [['none', 'Sin medias'], ['stockings', 'Rayadas'], ['tights', 'Panty'], ['red', 'De red'], ['calcetas', 'Calcetas'], ['brillantina', 'Medias de brillantina', { color: 0x2a1640 }], ['redNeon', 'Red de neón', { color: 0xff3a9a }], ['mediasRayo', 'Medias eléctricas', { color: 0x10142a }]],
    shoes: [['platform', 'Plataformas'], ['tallboots', 'Botas altas'], ['hightops', 'Zapatillas altas'], ['cristal', 'Plataformas de cristal', { color: 0xff8ad8 }], ['botasHolo', 'Botas holográficas', { color: 0xd8d0ff }], ['botasFuego', 'Botas de fuego', { color: 0x2a0805 }]],
    gloves: [['none', 'Sin guantes'], ['mitones', 'Mitones'], ['red', 'De red'], ['largos', 'Largos'], ['guanteHolo', 'Guantes holográficos', { color: 0xe0d8ff }], ['estelares', 'Mitones estelares', { color: 0x6a2ab8 }], ['guantesCristal', 'Guantes de cristal', { color: 0xbfe8ff }]],
    guitar: [['offset', 'Offset'], ['heart', 'Corazón'], ['star', 'Estrella'], ['mariposa', 'Mariposa', { body: 0xe0d8ff }], ['luna', 'Luna creciente', { body: 0x3a1a8a }], ['gema', 'Gema', { body: 0x9ae8ff }]],
    necklace: [['none', 'Ninguno'], ['choker', 'Gargantilla'], ['chokerTachas', 'Gargantilla con tachas'], ['corazon', 'Corazón'], ['perlas', 'Perlas'], ['corazonCristal', 'Corazón de cristal', { color: 0xff7ac8 }], ['lunaCollar', 'Collar lunar', { color: 0x3a1a8a }], ['mariposaCollar', 'Mariposa de luz', { color: 0x4ad8ff }]],
    earrings: [['none', 'Ninguno'], ['aros', 'Argollas grandes'], ['estrellas', 'Estrellas'], ['gotas', 'Gotas'], ['fugaces', 'Estrellas fugaces', { color: 0xffd23a }], ['gotasDiamante', 'Gotas de diamante', { color: 0xbfefff }], ['corazonesNeon', 'Corazones de neón', { color: 0xff3a9a }]],
    bracelets: [['none', 'Ninguna'], ['aros', 'Esclavas'], ['perlas', 'Perlas'], ['puas', 'Púas'], ['diamanteBr', 'Esclavas de diamante', { color: 0xe8e0ff }], ['luzBr', 'Pulsera de luz', { color: 0xff4a9a }], ['fuegoBr', 'Brazalete de fuego', { color: 0xff5a10 }]],
    tatDesign: [['estrellas', 'Estrellas'], ['corazon', 'Corazón'], ['rosa', 'Rosa'], ['murcielago', 'Murciélago'], ['golondrina', 'Golondrina'], ['mariposaT', 'Mariposa de luz', { color: 0x4ad8ff }], ['lunaT', 'Luna mágica', { color: 0xc07bff }], ['rosaNeon', 'Rosa de neón', { color: 0xff3a9a }]],
    tatSpot: [['brazoI', 'Brazo izq.'], ['brazoD', 'Brazo der.'], ['antebrazoI', 'Antebrazo izq.'], ['clavicula', 'Clavícula'], ['musloI', 'Muslo izq.'], ['musloD', 'Muslo der.'], ['cuello', 'Cuello'], ['manoI', 'Mano izq.'], ['mejilla', 'Bajo el ojo']],
    names: ['Luna Lava', 'Nina Nitro', 'Roxy Riff', 'Sonia Sónica', 'Kira Kaos', 'Mila Metralla', 'Vera Voltio'],
  },
};
export const PAL = {
  skin: [0xf6d2b6, 0xf3c9a4, 0xeab68e, 0xdca27a, 0xc68a5e, 0xa86e48, 0x8a5636, 0x6a3e26],
  ui: ['#ff4a6a', '#4ad8ff', '#ffd23a', '#9dff4a', '#ff8a2a', '#e08cff', '#4aff9a', '#ff7ac8'],
  eyes: [0x3a2a18, 0x6a4a22, 0x2a4a7a, 0x3a9ae8, 0x2a6a3a, 0x6a3aa8, 0xc8302a, 0xe8b020, 0xff4a9a, 0x9aa0a8],
  hair: [0x1a1410, 0x3a2a20, 0x5a3418, 0x7a4e26, 0xe8c86a, 0xf6e3a0, 0xc8401a, 0xe86a30, 0x3cf03c, 0x1fae2a, 0x7d3fd0, 0x9a5cf0, 0x2a7ae8, 0x4a9aff, 0xff4a9a, 0xff8ac0, 0xe8e8e8, 0xbbbbbb, 0x111111, 0xd8262b, 0x2ac8c8],
  brow: [0x111111, 0x2a1a10, 0x4a2e14, 0x8a6a3a, 0xc8a050, 0x4a1f80, 0xd8262b, 0xe8e8e8],
  cloth: [0x161616, 0x3a3a44, 0xeeeeee, 0xd8262b, 0x7a1020, 0x2a4ad8, 0x4a5f86, 0x7a2ab8, 0x9a4fdc, 0x1f8a3a, 0x62e83c, 0xff8a1a, 0xff4a9a, 0x2ac8c8, 0xffd23a],
  mk: [0x111111, 0x8a3ee6, 0xc07a90, 0xd8262b, 0x2a7ae8, 0x1f8a3a, 0xffd23a, 0xff4a9a, 0xeeeeee],
  lips: [0xc8355f, 0xd8262b, 0x8a1030, 0x3a1030, 0x111111, 0xff7ac8, 0xb0505a, 0x6a3aa8],
  metal: [0xc9ccd6, 0xd9a63a, 0x1a1a1a, 0xff7ac8, 0xb06a3a, 0xf4efe6, 0x8a3ee6, 0xd8262b],
  ink: [0x1a1420, 0xd8262b, 0x2a7ae8, 0x1f8a3a, 0xffd23a, 0xc07bff, 0xff7ac8, 0xff8a1a],
  guard: [0xf6f1df, 0xf2f2f2, 0x111111, 0xd8262b, 0xff7ac8, 0x2a2a2a, 0xd9a63a],
};
export const CUERPOS = ['m', 'f'];
export const LARGO_NOMBRE = 24, MAX_TATUAJES = 5;

export function defaultLook(g) {
  return g === 'f' ? {
    name: 'Nueva rockera', ui: '#ff4a9a', body: 'f', skin: 0xf3c9a4,
    face: { faceShape: 'ovalF', eyeShape: 'grandes', eyeStyle: 'brillo', eyes: 0x2a4a7a, eyes2: 0xff4a9a, browStyle: 'arqueadas', brow: 0x2a1a10, mkStyle: 'natural', mkColor: 0xc07a90, lipColor: 0xc8355f },
    hair: { style: 'longF', color: 0x1a1410, color2: 0x3a2a20, accent: 0xff4a9a, ribbon: 0x161616 }, beard: null,
    top: { type: 'crop', color: 0x161616, accent: 0xf4ecff, buttons: 0xff7ac8 }, bottom: { type: 'skirt', color: 0x7a1020, color2: 0xff4a9a }, belt: 0x161616,
    legwear: { type: 'red', color: 0x111111, color2: 0xff4a9a }, shoes: { type: 'platform', color: 0x161616 }, gloves: { type: 'none', color: 0x161616 },
    guitar: { type: 'heart', body: 0xff4a9a, guard: 0xf2f2f2, knob: 0xf6f1df },
    necklace: { type: 'choker', color: 0x161616 }, earrings: { type: 'aros', color: 0xd9a63a }, bracelets: { type: 'none', color: 0xff7ac8 }, tattoos: [], acc: {},
  } : {
    name: 'Nuevo rockero', ui: '#4ad8ff', body: 'm', skin: 0xeab68e,
    face: { faceShape: 'cuadrada', eyeShape: 'normales', eyeStyle: 'clasico', eyes: 0x3a2a18, eyes2: 0xe8b020, browStyle: 'gruesas', brow: 0x2a1a10, mkStyle: 'ninguno', mkColor: 0x111111 },
    hair: { style: 'long', color: 0x1a1410, color2: 0x3a2a20 }, beard: { type: 'stubble', color: 0x1a1410 },
    top: { type: 'tee', color: 0x161616 }, bottom: { type: 'jeans', color: 0x4a5f86 }, belt: 0x222222, legwear: null,
    shoes: { type: 'boot', color: 0x1a1a1a }, gloves: { type: 'none', color: 0x161616 },
    guitar: { type: 'vee', body: 0x161616, guard: 0xf2f2f2, knob: 0xd9a63a },
    necklace: { type: 'none', color: 0xc9ccd6 }, earrings: { type: 'none', color: 0xc9ccd6 }, bracelets: { type: 'tachas', color: 0x161616 }, tattoos: [], acc: {},
  };
}
/* rockero al azar: solo opciones del catálogo de su cuerpo. `R` da un número en [0, 1). */
export function randomLook(g, R = Math.random) {
  const pick = a => a[Math.floor(R() * a.length)];
  g = g || (R() < 0.5 ? 'f' : 'm'); const f = g === 'f', C = ED_CAT[g], L = defaultLook(g), P = k => { const l = C[k], n = l.filter(o => !o[2]); return (R() < 0.08 || !n.length ? pick(l) : pick(n))[0]; }, cl = () => pick(PAL.cloth);
  const hi = Math.floor(R() * PAL.hair.length / 2) * 2, hc = [PAL.hair[hi], PAL.hair[hi + 1] ?? PAL.hair[hi]];
  Object.assign(L, { name: pick(C.names), ui: pick(PAL.ui), skin: pick(PAL.skin) });
  Object.assign(L.face, { faceShape: P('faceShape'), eyeShape: P('eyeShape'), eyeStyle: P('eyeStyle'), eyes: pick(PAL.eyes), eyes2: pick(PAL.eyes), browStyle: P('browStyle'), brow: hexK(hc[0], 0.8), mkStyle: f || R() < 0.45 ? P('mkStyle') : 'ninguno', mkColor: pick(PAL.mk) });
  if (f) L.face.lipColor = pick(PAL.lips);
  L.hair = { style: P('hair'), color: hc[0], color2: hc[1], accent: cl(), ribbon: cl() };
  if (!f) L.beard = { type: R() < 0.35 ? 'none' : P('beard'), color: hexK(hc[0], 0.85) };
  L.top = { type: P('top'), color: cl(), accent: R() < 0.5 ? 0xf4ecff : cl(), buttons: cl() };
  L.bottom = { type: P('bottom'), color: cl(), color2: cl() };
  if (f) L.legwear = { type: P('legwear'), color: cl(), color2: cl() };
  L.shoes = { type: P('shoes'), color: pick([0x161616, 0x8b2fd0, 0xd8262b, 0xeeeeee, 0x2a1c12, 0xff4a9a]) };
  L.gloves = { type: R() < 0.4 ? 'none' : P('gloves'), color: pick([0x161616, 0x241a30, 0x2a2a2e]) };
  L.guitar = { type: P('guitar'), body: cl(), guard: pick(PAL.guard), knob: pick([0xf6f1df, 0x111111, 0xd9a63a]) };
  L.necklace = { type: R() < 0.35 ? 'none' : P('necklace'), color: pick(PAL.metal) };
  L.earrings = { type: R() < 0.4 ? 'none' : P('earrings'), color: pick(PAL.metal) };
  L.bracelets = { type: R() < 0.4 ? 'none' : P('bracelets'), color: pick(PAL.metal) };
  L.tattoos = R() < 0.6 ? [{ design: P('tatDesign'), spot: P('tatSpot'), color: pick(PAL.ink) }] : [];
  L.acc = f ? {} : { studs: R() < 0.5, chain: R() < 0.4, bulletBelt: R() < 0.25 };
  if (L.hair.style === 'mohawk' || L.hair.style === 'bald') L.face.brow = 0x1a1a1a;
  legDefaults(L);
  return L;
}
/* configuraciones antiguas (acc.gloves, acc.necklace, ...) → campos nuevos */
export function normalizeLook(c) {
  const L = { ...c, face: { ...(c.face || {}) }, acc: { ...(c.acc || {}) } }, A = L.acc, f = L.body === 'f';
  if (L.gloves === undefined) L.gloves = A.gloves !== undefined ? { type: f ? 'mitones' : 'sinDedos', color: A.gloves } : null;
  if (L.necklace === undefined) L.necklace = A.necklace ? { type: f ? 'corazon' : 'colmillo', color: 0xc9ccd6, pendant: 0xd9a63a } : null;
  if (L.earrings === undefined) L.earrings = A.earring ? { type: f ? 'aros' : 'argolla', color: 0xc9ccd6 } : null;
  if (L.bracelets === undefined) L.bracelets = A.wrist !== undefined ? { type: f ? 'puas' : A.studs ? 'tachas' : 'cuero', color: A.wrist } : null;
  if (L.bottom?.rips && L.bottom.type === 'jeans') L.bottom = { ...L.bottom, type: 'jeansRips' };
  L.tattoos = L.tattoos || [];
  return L;
}
export const getP = (o, p) => p.split('.').reduce((a, k) => a == null ? undefined : a[k], o);
export const setP = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); let a = o; for (const k of ks) { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; } a[last] = v; };
export const ED_FIELDS = [['face.faceShape', 'faceShape'], ['face.eyeShape', 'eyeShape'], ['face.eyeStyle', 'eyeStyle'], ['face.browStyle', 'browStyle'], ['face.mkStyle', 'mkStyle'], ['hair.style', 'hair'], ['beard.type', 'beard'], ['top.type', 'top'], ['bottom.type', 'bottom'], ['legwear.type', 'legwear'], ['shoes.type', 'shoes'], ['gloves.type', 'gloves'], ['guitar.type', 'guitar'], ['necklace.type', 'necklace'], ['earrings.type', 'earrings'], ['bracelets.type', 'bracelets']];
/* legendarios: al elegirlos se cargan sus colores de fábrica (only = una sola ruta) */
export function legDefaults(L, only) {
  const C = ED_CAT[L.body === 'f' ? 'f' : 'm'];
  for (const [p, c] of ED_FIELDS) {
    if (only && only !== p) continue;
    const it = C[c].find(o => o[0] === getP(L, p)), par = it?.[2] && getP(L, p.split('.').slice(0, -1).join('.'));
    if (par) Object.assign(par, it[2]);
  }
  if (!only) for (const t of L.tattoos || []) { const it = C.tatDesign.find(o => o[0] === t.design); if (it?.[2]) t.color = it[2].color; }
}
/* copia editable: completa campos, quita lo que no pertenece a su cuerpo y los ajustes numéricos finos de la cara */
export function sanitizeLook(src) {
  const g = src.body === 'f' ? 'f' : 'm', D = defaultLook(g), L = normalizeLook(JSON.parse(JSON.stringify(src))), C = ED_CAT[g];
  for (const k of ['face', 'hair', 'top', 'bottom', 'shoes', 'gloves', 'guitar', 'necklace', 'earrings', 'bracelets']) L[k] = { ...D[k], ...(L[k] || {}) };
  L.legwear = D.legwear ? { ...D.legwear, ...(L.legwear || {}) } : null;
  L.beard = D.beard ? { ...D.beard, ...(L.beard || {}) } : null;
  for (const k of ['name', 'ui', 'skin', 'belt']) if (L[k] == null) L[k] = D[k];
  if (L.legwear?.a) { L.legwear.color = parseInt(L.legwear.a.slice(1), 16); L.legwear.color2 = parseInt((L.legwear.b || '#111111').slice(1), 16); delete L.legwear.a; delete L.legwear.b; delete L.legwear.ruffle; }
  for (const [p, c] of ED_FIELDS) { const list = C[c]; if (list.length && !list.some(o => o[0] === getP(L, p))) setP(L, p, getP(D, p) ?? list[0][0]); }
  for (const k of ['eyeSize', 'eyeGap', 'nose', 'noseW', 'lips', 'mouthW', 'jaw', 'chin', 'cheek', 'browThick', 'browArch', 'browRidge', 'faceW', 'lashLen', 'makeup', 'shadow', 'tilt', 'liner']) delete L.face[k];
  L.tattoos = (L.tattoos || []).filter(t => C.tatDesign.some(o => o[0] === t.design) && C.tatSpot.some(o => o[0] === t.spot));
  delete L.build; delete L.nails;
  return L;
}

/* ---------- lo que viene de otra cuenta (o de la base): se limpia entero ----------
   Un rockero guardado es un JSON que escribió un navegador: lo que no está
   en el catálogo se cae, cada color es un entero de 24 bits, el nombre se
   corta y `ui` es #rrggbb o el de fábrica. Así, lo que pinta la escena (o
   el mercado) nunca es algo que alguien inventó en la consola. */
const COLOR = x => (Number.isInteger(x) && x >= 0 && x <= 0xffffff ? x : null);
const LOOK_COLORES = {
  face: ['eyes', 'eyes2', 'brow', 'mkColor', 'lipColor'], hair: ['color', 'color2', 'accent', 'ribbon'], beard: ['color'],
  top: ['color', 'accent', 'buttons', 'bow'], bottom: ['color', 'color2'], legwear: ['color', 'color2'], shoes: ['color'], gloves: ['color'],
  guitar: ['body', 'guard', 'knob', 'head'], necklace: ['color', 'pendant'], earrings: ['color'], bracelets: ['color'],
};
export function limpiaLook(x) {
  let src = x;
  if (typeof src === 'string') { try { src = JSON.parse(src); } catch { src = null; } }
  if (!src || typeof src !== 'object') return null;
  const g = src.body === 'f' ? 'f' : 'm', D = defaultLook(g), L = sanitizeLook({ body: g });
  L.name = typeof src.name === 'string' && src.name.trim() ? src.name.trim().slice(0, LARGO_NOMBRE) : D.name;
  L.ui = typeof src.ui === 'string' && /^#[0-9a-f]{6}$/i.test(src.ui) ? src.ui.toLowerCase() : D.ui;
  L.skin = COLOR(src.skin) ?? D.skin;
  L.belt = COLOR(src.belt) ?? D.belt;
  const C = ED_CAT[g];
  for (const [k, cols] of Object.entries(LOOK_COLORES)) {
    if (!L[k]) continue;
    const o = src[k] && typeof src[k] === 'object' ? src[k] : {};
    for (const c of cols) { const v = COLOR(o[c]); if (v !== null) L[k][c] = v; }
  }
  for (const [p, c] of ED_FIELDS) {
    if (!getP(L, p.split('.')[0])) continue;
    const v = getP(src, p);
    if (typeof v === 'string' && C[c].some(o => o[0] === v)) setP(L, p, v);
  }
  L.tattoos = (Array.isArray(src.tattoos) ? src.tattoos : []).slice(0, MAX_TATUAJES)
    .filter(t => t && C.tatDesign.some(o => o[0] === t.design) && C.tatSpot.some(o => o[0] === t.spot))
    .map(t => ({ design: t.design, spot: t.spot, color: COLOR(t.color) ?? 0x1a1420 }));
  const A = src.acc && typeof src.acc === 'object' ? src.acc : {};
  L.acc = g === 'm' ? { studs: A.studs === true, chain: A.chain === true, bulletBelt: A.bulletBelt === true } : {};
  return L;
}

/* =====================================================================
   CAJAS E INVENTARIO — atuendos, guitarras y accesorios se desbloquean abriendo cajas; cada premio trae sus colores
   ===================================================================== */
export const PRECIO_CAJA = 500;
/* 1 de cada 10 legendario, en diez milésimas (como Mascotas). */
export const LEGENDARIO = 1000;
/* Repetido exacto (misma pieza y mismos colores que una que ya tienes): devuelve monedas. */
export const REEMBOLSO = { comun: 100, leg: 250 };
export const INV_CATS = {
  top: { n: 'Torso', ic: '👕', cols: ['color', 'accent'] },
  bottom: { n: 'Pantalones y faldas', ic: '👖', cols: ['color', 'color2'] },
  legwear: { n: 'Medias', ic: '🧦', cols: ['color', 'color2'] },
  shoes: { n: 'Calzado', ic: '👢', cols: ['color'] },
  gloves: { n: 'Guantes', ic: '🧤', cols: ['color'] },
  guitar: { n: 'Guitarras', ic: '🎸', cols: ['body', 'guard', 'knob'] },
  necklace: { n: 'Collares', ic: '🔗', cols: ['color'] },
  earrings: { n: 'Aros', ic: '💎', cols: ['color'] },
  bracelets: { n: 'Pulseras', ic: '⛓️', cols: ['color'] },
  /* la cara y el pelo (desde CORTE_CAJAS_2): todo lo de una categoría con legendarios sale en las cajas, menos
     lo que trae el rockero por defecto y «nada». No traen colores: el color lo eliges tú. `ruta` = dónde está
     el tipo en el rockero; los tatuajes son una lista (cada diseño puesto tiene que ser tuyo). */
  hair: { n: 'Peinados', ic: '💇', cols: [], ruta: 'hair.style', cara: true },
  eyeStyle: { n: 'Pupilas', ic: '👁️', cols: [], ruta: 'face.eyeStyle', cara: true },
  mkStyle: { n: 'Maquillaje y pintura', ic: '🎨', cols: [], ruta: 'face.mkStyle', cara: true },
  beard: { n: 'Barbas', ic: '🧔', cols: [], ruta: 'beard.type', cara: true },
  tatDesign: { n: 'Diseños de tatuaje', ic: '🖋️', cols: [], ruta: null, cara: true },
};
/* las opciones «nada» (sin barba, sin pintura…): de todos, no salen en cajas */
export const esNada = t => t === 'none' || t === 'ninguno' || t === 'ningunoF';
/* dónde va el tipo de la categoría `k` en un rockero (null: los tatuajes) */
export const rutaInv = k => (INV_CATS[k].ruta !== undefined ? INV_CATS[k].ruta : k + '.type');
/* la categoría de una ruta del editor ('hair.style' → 'hair'), o null si no es del inventario */
export const catDeRuta = p => Object.keys(INV_CATS).find(k => rutaInv(k) === p) || null;
/* colores al azar de cada premio (en los legendarios se respetan los de fábrica que definen su efecto).
   `r.pick(lista)` elige uno y `r.moneda()` es cara o sello: con el azar de la caja, sale lo mismo en todos lados. */
export const INV_RAND = {
  top: r => ({ color: r.pick(PAL.cloth), accent: r.moneda() ? 0xf4ecff : r.pick(PAL.cloth) }),
  bottom: r => ({ color: r.pick(PAL.cloth), color2: r.pick(PAL.cloth) }),
  legwear: r => ({ color: r.pick(PAL.cloth), color2: r.pick(PAL.cloth) }),
  shoes: r => ({ color: r.pick([...PAL.cloth, 0x2a1c12, 0x8b2fd0]) }),
  gloves: r => ({ color: r.pick([...PAL.cloth, 0x241a30]) }),
  guitar: r => ({ body: r.pick(PAL.cloth), guard: r.pick(PAL.guard), knob: r.pick([0xf6f1df, 0x111111, 0xd9a63a, 0xc9ccd6, 0xd8262b]) }),
  necklace: r => ({ color: r.pick(PAL.metal) }), earrings: r => ({ color: r.pick(PAL.metal) }), bracelets: r => ({ color: r.pick(PAL.metal) }),
  hair: () => ({}), eyeStyle: () => ({}), mkStyle: () => ({}), beard: () => ({}), tatDesign: () => ({}),
};
export const invItem = (b, k, t) => ED_CAT[b]?.[k]?.find(o => o[0] === t);
export const nombreItem = (b, k, t) => invItem(b, k, t)?.[1] ?? t;
export const invVar = (b, k, o) => { const c = {}; for (const f of INV_CATS[k].cols) if (o[f] != null) c[f] = o[f]; return { b, k, t: o.type, c, leg: !!invItem(b, k, o.type)?.[2] }; };
/* la variante que lleva puesta un rockero en la categoría `k` (no sirve para los tatuajes) */
export const invVarL = (L, k) => { const r = rutaInv(k), par = getP(L, r.split('.').slice(0, -1).join('.')) || {}; return invVar(L.body, k, { ...par, type: getP(L, r) }); };
export const invId = v => [v.b, v.k, v.t, ...INV_CATS[v.k].cols.map(f => v.c[f] ?? '')].join(':');
/* la clave de la foto de una pieza en localStorage (la escena la saca; el salón de Juegos la lee, mismo origen).
   Subir el número cuando cambia cómo se ve un rockero: las fotos guardadas quedan viejas. */
export const claveMiniId = id => 'rock-mini-2:' + id;
export const claveMini = v => claveMiniId(invId(v));
/* de partida: lo que trae cada cuerpo por defecto + la ropa que usan los rockeros de fábrica (de la cara y el
   pelo, solo lo del rockero por defecto y el primer diseño de tatuaje). Toda cuenta lo tiene: no se compra, no
   tiene copia y no se vende. */
let _ini = null;
export function iniciales() {
  if (_ini) return _ini;
  const out = new Map(), pon = v => out.set(invId(v), v);
  const add = (L, cara) => {
    for (const k in INV_CATS) {
      if (k === 'tatDesign' || (INV_CATS[k].cara && !cara)) continue;
      if (!getP(L, rutaInv(k).split('.')[0])) continue;
      const v = invVarL(L, k);
      if (v.t && !esNada(v.t) && invItem(L.body, k, v.t)) pon(v);
    }
  };
  for (const g of CUERPOS) { add(defaultLook(g), true); pon(invVar(g, 'tatDesign', { type: ED_CAT[g].tatDesign[0][0] })); }
  for (const r of ['violeta', 'rex', 'kid']) add(sanitizeLook(ROCKERS[r]), false);
  return (_ini = Object.freeze([...out.values()].map(v => Object.freeze(v))));
}

/* ---------- lo que puede traer una caja ----------
   **Solo se agrega al final**: lo que sale es un índice dentro de la lista
   de su cuerpo y su clase (común o legendaria), así que insertar o
   reordenar cambiaría lo que ya salió en todas las cajas abiertas. Cada
   fila es [cuerpo, categoría, tipo]; un test comprueba que todo lo del
   catálogo (menos «none») está aquí y que nada de aquí falta en él. */
export const POOL = Object.freeze([
  ['m', 'top', 'tank'],
  ['m', 'top', 'tee'],
  ['m', 'top', 'leather'],
  ['m', 'top', 'longsleeve'],
  ['m', 'top', 'infernal'],
  ['m', 'top', 'cromo'],
  ['m', 'top', 'neonTank'],
  ['m', 'bottom', 'jeans'],
  ['m', 'bottom', 'jeansRips'],
  ['m', 'bottom', 'leatherPants'],
  ['m', 'bottom', 'plaid'],
  ['m', 'bottom', 'shorts'],
  ['m', 'bottom', 'magma'],
  ['m', 'bottom', 'tormenta'],
  ['m', 'bottom', 'jeansGalaxia'],
  ['m', 'shoes', 'boot'],
  ['m', 'shoes', 'sneaker'],
  ['m', 'shoes', 'chelsea'],
  ['m', 'shoes', 'botasInfierno'],
  ['m', 'shoes', 'botasCromo'],
  ['m', 'shoes', 'zapasNeon'],
  ['m', 'gloves', 'sinDedos'],
  ['m', 'gloves', 'tachas'],
  ['m', 'gloves', 'completos'],
  ['m', 'gloves', 'tesla'],
  ['m', 'gloves', 'garrasMagma'],
  ['m', 'gloves', 'cosmicos'],
  ['m', 'guitar', 'vee'],
  ['m', 'guitar', 'sg'],
  ['m', 'guitar', 'explorer'],
  ['m', 'guitar', 'hacha'],
  ['m', 'guitar', 'rayoG'],
  ['m', 'guitar', 'llamaG'],
  ['m', 'necklace', 'colmillo'],
  ['m', 'necklace', 'placas'],
  ['m', 'necklace', 'pinchos'],
  ['m', 'necklace', 'colmilloFuego'],
  ['m', 'necklace', 'amuleto'],
  ['m', 'necklace', 'calaveraCr'],
  ['m', 'earrings', 'argolla'],
  ['m', 'earrings', 'arete'],
  ['m', 'earrings', 'cruz'],
  ['m', 'earrings', 'gemaSangre'],
  ['m', 'earrings', 'rayoArete'],
  ['m', 'earrings', 'cruzFuego'],
  ['m', 'bracelets', 'tachas'],
  ['m', 'bracelets', 'cuero'],
  ['m', 'bracelets', 'cadena'],
  ['m', 'bracelets', 'magmaBr'],
  ['m', 'bracelets', 'teslaBr'],
  ['m', 'bracelets', 'galaxiaBr'],
  ['f', 'top', 'jacket'],
  ['f', 'top', 'crop'],
  ['f', 'top', 'corset'],
  ['f', 'top', 'diamante'],
  ['f', 'top', 'holoTop'],
  ['f', 'top', 'chaquetaNeon'],
  ['f', 'bottom', 'skirt'],
  ['f', 'bottom', 'skirtPlaid'],
  ['f', 'bottom', 'mini'],
  ['f', 'bottom', 'pitillo'],
  ['f', 'bottom', 'shortsF'],
  ['f', 'bottom', 'faldaGalaxia'],
  ['f', 'bottom', 'pitilloHolo'],
  ['f', 'bottom', 'faldaFuego'],
  ['f', 'legwear', 'stockings'],
  ['f', 'legwear', 'tights'],
  ['f', 'legwear', 'red'],
  ['f', 'legwear', 'calcetas'],
  ['f', 'legwear', 'brillantina'],
  ['f', 'legwear', 'redNeon'],
  ['f', 'legwear', 'mediasRayo'],
  ['f', 'shoes', 'platform'],
  ['f', 'shoes', 'tallboots'],
  ['f', 'shoes', 'hightops'],
  ['f', 'shoes', 'cristal'],
  ['f', 'shoes', 'botasHolo'],
  ['f', 'shoes', 'botasFuego'],
  ['f', 'gloves', 'mitones'],
  ['f', 'gloves', 'red'],
  ['f', 'gloves', 'largos'],
  ['f', 'gloves', 'guanteHolo'],
  ['f', 'gloves', 'estelares'],
  ['f', 'gloves', 'guantesCristal'],
  ['f', 'guitar', 'offset'],
  ['f', 'guitar', 'heart'],
  ['f', 'guitar', 'star'],
  ['f', 'guitar', 'mariposa'],
  ['f', 'guitar', 'luna'],
  ['f', 'guitar', 'gema'],
  ['f', 'necklace', 'choker'],
  ['f', 'necklace', 'chokerTachas'],
  ['f', 'necklace', 'corazon'],
  ['f', 'necklace', 'perlas'],
  ['f', 'necklace', 'corazonCristal'],
  ['f', 'necklace', 'lunaCollar'],
  ['f', 'necklace', 'mariposaCollar'],
  ['f', 'earrings', 'aros'],
  ['f', 'earrings', 'estrellas'],
  ['f', 'earrings', 'gotas'],
  ['f', 'earrings', 'fugaces'],
  ['f', 'earrings', 'gotasDiamante'],
  ['f', 'earrings', 'corazonesNeon'],
  ['f', 'bracelets', 'aros'],
  ['f', 'bracelets', 'perlas'],
  ['f', 'bracelets', 'puas'],
  ['f', 'bracelets', 'diamanteBr'],
  ['f', 'bracelets', 'luzBr'],
  ['f', 'bracelets', 'fuegoBr'],
  // desde CORTE_CAJAS_2: la cara y el pelo (lo inicial de esas categorías no sale)
  ['m', 'hair', 'mohawk'],
  ['m', 'hair', 'spiky'],
  ['m', 'hair', 'short'],
  ['m', 'hair', 'bald'],
  ['m', 'hair', 'furia'],
  ['m', 'hair', 'trueno'],
  ['m', 'hair', 'llamarada'],
  ['m', 'eyeStyle', 'felino'],
  ['m', 'eyeStyle', 'anillo'],
  ['m', 'eyeStyle', 'hetero'],
  ['m', 'eyeStyle', 'fantasma'],
  ['m', 'eyeStyle', 'rayo'],
  ['m', 'eyeStyle', 'eclipse'],
  ['m', 'eyeStyle', 'vortice'],
  ['m', 'mkStyle', 'delineado'],
  ['m', 'mkStyle', 'corpse'],
  ['m', 'mkStyle', 'guerra'],
  ['m', 'mkStyle', 'ojeras'],
  ['m', 'mkStyle', 'calaNeon'],
  ['m', 'mkStyle', 'runas'],
  ['m', 'mkStyle', 'grietas'],
  ['m', 'beard', 'goatee'],
  ['m', 'beard', 'mustache'],
  ['m', 'beard', 'full'],
  ['m', 'beard', 'barbaFuego'],
  ['m', 'beard', 'escarcha'],
  ['m', 'beard', 'barbaRayo'],
  ['m', 'tatDesign', 'llamas'],
  ['m', 'tatDesign', 'tribal'],
  ['m', 'tatDesign', 'serpiente'],
  ['m', 'tatDesign', 'dragon'],
  ['m', 'tatDesign', 'fenix'],
  ['m', 'tatDesign', 'calaveraFuego'],
  ['f', 'hair', 'pigtails'],
  ['f', 'hair', 'bob'],
  ['f', 'hair', 'ponytail'],
  ['f', 'hair', 'odango'],
  ['f', 'hair', 'galaxiaH'],
  ['f', 'hair', 'neonTw'],
  ['f', 'hair', 'fenixH'],
  ['f', 'eyeStyle', 'corazon'],
  ['f', 'eyeStyle', 'estrella'],
  ['f', 'eyeStyle', 'degradado'],
  ['f', 'eyeStyle', 'galaxia'],
  ['f', 'eyeStyle', 'latido'],
  ['f', 'eyeStyle', 'prisma'],
  ['f', 'mkStyle', 'ahumado'],
  ['f', 'mkStyle', 'gotico'],
  ['f', 'mkStyle', 'glam'],
  ['f', 'mkStyle', 'estrellaMk'],
  ['f', 'mkStyle', 'cristales'],
  ['f', 'mkStyle', 'aurora'],
  ['f', 'mkStyle', 'mariposaMk'],
  ['f', 'tatDesign', 'corazon'],
  ['f', 'tatDesign', 'rosa'],
  ['f', 'tatDesign', 'murcielago'],
  ['f', 'tatDesign', 'golondrina'],
  ['f', 'tatDesign', 'mariposaT'],
  ['f', 'tatDesign', 'lunaT'],
  ['f', 'tatDesign', 'rosaNeon'],
].map(([b, k, t]) => Object.freeze({ b, k, t, leg: !!invItem(b, k, t)?.[2] })));

/* Las cajas compradas antes de CORTE_CAJAS_2 (hora del servidor) eligen entre las primeras POOL_1 filas, como
   cuando se abrieron: sumar filas cambia el sorteo uniforme (`r.entero(n)`), así que cada ampliación del
   catálogo de cajas necesita su propio corte. */
export const POOL_1 = 109, CORTE_CAJAS_2 = Date.UTC(2026, 9, 22, 4, 0);
/* Desde CORTE_CAJAS_3 los legendarios salen con colores al azar como los demás (su efecto toma esos colores);
   las de antes traían los de fábrica, y así se quedan. */
export const CORTE_CAJAS_3 = Date.UTC(2026, 9, 23, 3, 0);
export const poolDe = at => (at >= CORTE_CAJAS_2 ? POOL : POOL.slice(0, POOL_1));

/* Lo que trae una caja comprada a la hora `at`, con el azar que se le pasa: `r.entero(n)` en [0, n).
   Primero si es legendaria, después la pieza (uniforme en su clase y en el cuerpo de la caja) y al final
   sus colores (los legendarios de antes de CORTE_CAJAS_3, con los de fábrica). */
export function abreCaja(b, r, at = Infinity) {
  const g = b === 'f' ? 'f' : 'm', leg = r.entero(10000) < LEGENDARIO;
  const de = poolDe(at).filter(p => p.b === g && p.leg === leg), it = de[r.entero(de.length)];
  const az = { pick: a => a[r.entero(a.length)], moneda: () => r.entero(2) === 0 };
  const c = INV_RAND[it.k](az), fab = invItem(g, it.k, it.t)?.[2];
  if (fab && at < CORTE_CAJAS_3) for (const f of INV_CATS[it.k].cols) if (fab[f] != null) c[f] = fab[f];
  return { b: g, k: it.k, t: it.t, c, leg };
}

/* Lo que una cuenta puede ponerle a su rockero: lo inicial más lo suyo (`propias`,
   variantes {b, k, t, c}). Lo que no tiene se cambia por su última variante de esa
   pieza o, sin ninguna, por lo de fábrica (o nada, si la pieza admite «nada»).
   Se comprueba donde se ve, como los marcos: un rockero guardado con algo vendido
   después se ve sin eso. */
export function lookPosible(L, propias = []) {
  if (!L) return null;
  const todas = [...iniciales(), ...propias], D = defaultLook(L.body), C = ED_CAT[L.body];
  const tiene = (k, t) => esNada(t) || todas.some(v => v.b === L.body && v.k === k && v.t === t);
  for (const k in INV_CATS) {
    if (k === 'tatDesign') { L.tattoos = (L.tattoos || []).filter(t => tiene(k, t.design)); continue; }
    const ruta = rutaInv(k), par = getP(L, ruta.split('.').slice(0, -1).join('.')), t = getP(L, ruta);
    if (!par || !t || esNada(t)) continue;
    if (INV_CATS[k].cara) {
      if (tiene(k, t)) continue;
      const nada = C[k].find(x => esNada(x[0]));
      setP(L, ruta, nada ? nada[0] : getP(D, ruta));
      continue;
    }
    const o = par, mias = todas.filter(v => v.b === L.body && v.k === k && v.t === o.type);
    if (mias.some(v => invId(v) === invId(invVar(L.body, k, o)))) continue;
    if (mias.length) { Object.assign(o, mias[mias.length - 1].c); continue; }
    if (C[k].some(x => x[0] === 'none')) o.type = 'none';
    else Object.assign(o, D[k]);
  }
  return L;
}
