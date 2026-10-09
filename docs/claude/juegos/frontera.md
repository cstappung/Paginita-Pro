# Frontera Batalla — notes for Claude

Solo game on the Pokémon engine (`colabtex/src/juegos/frontera.js`, `pokemon/frontera-motor.js`). See also `colabtex/src/juegos/pokemon/CLAUDE.md` and `juegos/club/CLAUDE.md`.

**Frontera Batalla (`#solo/frontera`) is Emerald's Battle Frontier as a
Solo Club game**, played locally on the same `@pkmn/sim` bundle as the
Pokémon rooms (`PokeMotor.frontera`, from `pokemon/frontera-motor.js`; the
screen is `juegos/frontera.js`, which reuses `pokemon.js` with `ctx.local`).
Three facilities: **Torre** (your saved team, shared with the rooms), **Palacio**
(your team, but the Pokémon pick their own moves by nature, the Emerald
table) and **Fábrica** (rental trio, swap one after each win). Level 50 or
Abierto, the Emerald clauses (three different species, no repeated item,
enforced on rentals too in `armaSet`). Rivals are seven per round with
Showdown trainer sprites (`htmlRival`, skin `x:<id>:<name>`): generic classes
first, then gym leaders, Elite Four, champions and rivals as the streak
grows, with the Frontier Brains where Emerald puts them: Anabel at battles
35 and 70 of the Torre, Spenser and Noland at 21 and 42 of theirs. Difficulty rises with the streak in both team strength and the AI's
`iq` (`decideIA`). **Everything comes from a seed**, so a battle replays the
same. The run is saved in `localStorage` and in `users/<uid>/club/frontera`.
Categories are `club-frontera-<torre|palacio|fabrica>-<50|abierto>` (puntos =
best streak) and `club-frontera-victorias`. Each win pays
`monedasCombate(n)` (4 + 2 per streak step up to 10, +10 every seventh). The
regexes for `soloRanks` and `clubJugadas` were widened, so the rules must be
re-published. `tests/frontera.test.cjs` covers it.
