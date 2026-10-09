# Pokémon — notes for Claude

Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`. Frontera Batalla (solo, same engine): `docs/claude/juegos/frontera.md`.

**Pokémon (`pokemon`) is Pokémon Showdown's simulator, not a rewrite**
(`@pkmn/sim`, the MIT extraction of Showdown's `sim/`). Moves, abilities,
items, natures, the type chart of each generation, stats, Tera/Mega/Z, the
tiers and the team validator all come from it, so a battle here resolves
exactly as on Showdown. It is a **separate bundle** (`juegos-pokemon.js`,
~6 MB, ~1 MB gzipped, `npm run build:pokemon`, part of `build`) loaded the
first time someone opens a Pokémon room or the team editor
(`pokemon/carga.js`, with the page's `?v=`, like `colabdraw-math.js`; it is
not in `PAGES`). It hangs off `globalThis.PokeMotor` and `redPokemon` in
`motor.js` looks for it there, like Clue's `ClueMotor`; without it the room
reads `fase: "cargando"` and the screen calls `ctx.rehaz()` (a new hook in
`montaJuego`) to re-reduce once it lands. Things that hold it together:

- **A battle is a list of decision points**, and each point is written
  twice by *both* players: a promise `{t:"c", k, h}` with `h = H(choice +
  "|" + key_k)` and, once both promises are in, the reveal `{t:"r", k, c,
  l}`. Point 0 is the team (the packed Showdown team, plus `sk`, the trainer
  skin); the rest are whatever Showdown asks both sides at once (team
  preview, the turn's move or switch, a forced switch). Whoever has nothing
  to decide writes `"-"` (`NADA`), sent by the screen without asking.
- **The keys are a hash chain** (`cadenaPk`, `PK_CADENA` = 2000 in
  `motor.js`), from the private seed in `misPartidas`, tip `hcad` in the
  write-once ficha, as in cacho: H(key_k) must be the previous key. **The
  PRNG seed of point k is H(semilla | k | key₁ | key₂)** (`battle.resetRNG`
  before applying the choices), so nobody knows a crit or a miss before both
  have committed — that is also why the non-deciding side commits too. A
  reveal that does not match its promise or its chain is ignored and named
  in `falsas`. An impossible choice becomes Showdown's `default`.
- **Teams are public in the log** (the simulator needs both); the screen
  shows only what Showdown would (species at preview, the rest as it is
  revealed in the public log). That is the honest limit, and the manual says
  it. Teams are still chosen blind, behind the promise.
- `motor-pk.js` caches the live `Battle` per room and applies only the new
  log entries; the cache is keyed by a **signature of the applied entries
  that includes each `h`/`l`** — with type and author alone, two battles of
  the same shape were taken for the same one.
- The screen (`pokemon.js`) saves the promised choice in `localStorage`
  (`pk.pend.<pid>.<uid>`) **before** writing the promise: after a reload,
  that is the only way to reveal it. It has the usual heartbeat
  (`LATIDO_MS`) and retry (`REINTENTO_MS`). The narration is
  `pokemon/relato.js` (pure, Spanish sentences over Showdown's protocol;
  species, moves and items stay in English, as Showdown and Smogon write
  them). **Sprites are 2D only** (`urlsSprite`): PokeAPI/sprites'
  Black/White-style animated GIFs (`versions/generation-v/black-white/
  animated`, front and back) where they exist (`BW_FRENTE`/`BW_ESPALDA` in
  `pokemon/formas.js`, generated from that repo's tree), else the static
  2D PNG; minis ask for `fijo` and get the PNG straight away. Not
  `other/showdown`: from gen 6 on those are renders of 3D models. Forms map
  to PokeAPI ids through `pokemon/formas.js`, generated from PokeAPI's
  `pokemon.csv`.
- **The battle scene is built once and touched piece by piece**
  (`asegurarCampo`, `ponSprite`, `ponFicha`): the sprite's `src` changes only
  when the Pokémon does and the HP bar is always the same element, so its
  transition shows; repainting by `innerHTML` cut every animation short. New
  log lines become a **queue of steps** (`pasos`/`anima`): lunge on `move`,
  type-coloured impact, shake and the bar dropping to that line's HP on
  `-damage`, field shake on `-crit`, drop on `faint`, Poké Ball pop on
  `switch`, sparkle on Tera, weather overlays, and the trainers' VS intro on
  `start`, each step's sentence in the dialog box. Sprites and HP boxes wait
  for the queue (`pintaEscena` only touches them when it is idle), **the move
  menu too** (`pintaControl` shows "…" while `animando`), and `ocupado()`
  keeps the fin cartel back until the last KO has been seen. A hidden tab
  or more than `MAX_PASOS` steps skips straight to the end. The background
  (`BIOMAS`) comes from the room's seed, so both players see the same
  place. Trainers and party sit in a strip above the field (`.jg-pk-tira`).
  Trainer skins (`pokemon/entrenadores.js`) are the main-series
  protagonists, hot-linked from Showdown's trainer sprites because
  PokeAPI/sprites has none; if one fails, the initial is drawn.
- **Teams live in `users/<uid>/pokemon`** (`{equipos: {id: {nombre,
  formato, eq}}, skin}`, owner-only already, so no rule) with a
  `localStorage` copy. `pokemon/equipos.js` is the editor: paste/export
  Showdown text, or build each set (species, item, ability, nature, EVs,
  IVs, Tera, moves from the learnset), with live stats and the validator's
  own messages. The room option is `formato` (not `modo`, which the rules
  whitelist); the list is `pokemon/formatos.js`, shared with the lobby so it
  does not need the bundle.
- **Random Battle formats** (`gen9/8/7randombattle`, `esAleatorio`) use
  Showdown's own generator (`@pkmn/randoms`, the curated sets of the real
  server), never arbitrary Pokémon. At point 0 both sides promise `NADA`, and
  side i's team is `getTeamGenerator(formato, "sodium," + H(semilla|eq|i|both
  keys))`, so nobody knows or steers it until both committed. Generated teams
  are not validated.

`tests/pokemon.test.cjs` bundles the engine with esbuild and plays robot
battles through the promise protocol, checking that a late tab replays the
same battle, that a forged reveal or key does not count, that an illegal
team loses, that an impossible choice falls back to default, and the
narration. `'pokemon'` needed the rules' `juego` and `logros` whitelists, so
they must be re-published.
