#!/usr/bin/env node
/* Genera juegos/club/pokelike/especies.js con los 151 Pokémon de Gen 1
   sacados de PokeAPI: nombre en español, tipos modernos (Clefairy es Hada),
   stats base modernas, experiencia base, tasa de captura y evoluciones.

   Se corre a mano, una vez (`node scripts/pokelike-datos.cjs` desde
   colabtex/), y el resultado se commitea: el juego no pide nada a PokeAPI
   en tiempo de juego salvo los sprites.

   Evoluciones simplificadas: todas son por nivel. Las de piedra pasan a
   NIVEL_PIEDRA y las de intercambio a NIVEL_INTERCAMBIO; Eevee elige al
   azar entre sus tres al evolucionar (lo decide el motor). */
const fs = require('fs');
const path = require('path');

const API = 'https://pokeapi.co/api/v2';
const SALIDA = path.join(__dirname, '..', '..', 'juegos', 'club', 'pokelike', 'especies.js');
const NIVEL_PIEDRA = 30;
const NIVEL_INTERCAMBIO = 38;
const NIVEL_AMISTAD = 25;

const TIPOS = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', grass: 'Planta', electric: 'Eléctrico',
  ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador',
  psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón',
  dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
};

async function pide(url, intentos = 4) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return await r.json();
    } catch (e) {
      if (i >= intentos) throw e;
      await new Promise(res => setTimeout(res, 500 * (i + 1)));
    }
  }
}

const idDeUrl = u => Number(u.replace(/\/$/, '').split('/').pop());

function nivelDeEvo(det) {
  const d = det[0] || {};
  if (d.trigger?.name === 'level-up' && d.min_level) return d.min_level;
  if (d.trigger?.name === 'level-up') return NIVEL_AMISTAD;
  if (d.trigger?.name === 'use-item') return NIVEL_PIEDRA;
  if (d.trigger?.name === 'trade') return NIVEL_INTERCAMBIO;
  return NIVEL_PIEDRA;
}

async function main() {
  const especies = {};
  const cadenas = new Set();
  // De a 10 en paralelo, para no abusar de la API.
  for (let base = 1; base <= 151; base += 10) {
    const ids = [];
    for (let id = base; id < base + 10 && id <= 151; id++) ids.push(id);
    await Promise.all(ids.map(async id => {
      const [p, s] = await Promise.all([pide(`${API}/pokemon/${id}`), pide(`${API}/pokemon-species/${id}`)]);
      const st = Object.fromEntries(p.stats.map(x => [x.stat.name, x.base_stat]));
      const es = s.names.find(n => n.language.name === 'es')?.name || p.name;
      especies[id] = {
        n: es,
        t: p.types.sort((a, b) => a.slot - b.slot).map(x => TIPOS[x.type.name]),
        b: [st.hp, st.attack, st.defense, st['special-attack'], st['special-defense'], st.speed],
        xp: p.base_experience,
        cap: s.capture_rate,
        evo: [],
      };
      cadenas.add(idDeUrl(s.evolution_chain.url));
    }));
    process.stdout.write(`\r${Math.min(base + 9, 151)}/151`);
  }
  process.stdout.write('\ncadenas…\n');
  for (const c of cadenas) {
    const cad = await pide(`${API}/evolution-chain/${c}`);
    const recorre = nodo => {
      const de = idDeUrl(nodo.species.url);
      for (const sig of nodo.evolves_to) {
        const a = idDeUrl(sig.species.url);
        if (de <= 151 && a <= 151) especies[de].evo.push({ a, nv: nivelDeEvo(sig.evolution_details) });
        recorre(sig);
      }
    };
    recorre(cad.chain);
  }
  const lineas = Object.keys(especies).map(Number).sort((a, b) => a - b)
    .map(id => `  ${id}: ${JSON.stringify(especies[id])},`);
  const js = `/* GENERADO por colabtex/scripts/pokelike-datos.cjs desde PokeAPI — no editar a mano.
   n: nombre · t: tipos (tabla moderna) · b: [ps, ataque, defensa, at.esp, def.esp, velocidad]
   xp: experiencia base · cap: tasa de captura · evo: [{a: id, nv: nivel}] */
(function (raiz) {
  const ESPECIES = {
${lineas.join('\n')}
  };
  if (typeof module === 'object' && module.exports) module.exports = ESPECIES;
  else raiz.PokelikeEspecies = ESPECIES;
})(typeof self !== 'undefined' ? self : this);
`;
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, js);
  console.log('escrito', SALIDA);
}

main().catch(e => { console.error(e); process.exit(1); });
