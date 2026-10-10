# Escondite — notes for Claude

Screen: `colabtex/src/juegos/escondite.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

**The scenery is a seed, not an image.** `escena(semilla)` lays out a couple of
hundred pieces from a mulberry32 PRNG and `juegos/paisaje.js` draws them; the
two machines share a 32-bit number and get the same landscape. An image would
have to be uploaded somewhere, served with CORS and waited for. The pieces are
deliberately simple and drawn from six-tone palettes: what makes a hiding place
hard is repetition, not detail — two hundred nearly identical trees hide a
person far better than a photographic forest.

The seed now picks one of five **themed scenes** (`TEMAS`: playa, mercado,
feria, nieve, lago) instead of scattering random props. Each scene is built
from `zona` bands, so it reads as a place: backdrops (sea, stalls, a frozen
lake) are painted first and the pieces sit where they belong. The crowd is
around a hundred people (80–120 depending on the scene) dressed from the same
palettes, and `poseEn` decides from the
spot whether someone stands, swims or skis. The target is a **costume**, not
just a colour: a hat (6), a shirt (6 selectable) and an accessory (4) give
`TRAJES_N` = 144 codes, `codigoTraje({h,s,a}) = h + s·6 + a·36`. A code below
6 decodes to the old "hat only" costume, so rooms from before still read.
`vistePersona` then bumps the accessory of any crowd member who happens to
wear all three pieces. It runs inside `paisaje.pinta`, so both screens see the
same crowd and there is never a twin to click by mistake.

- **The escondite draws the hidden person from the first second.** It used not
  to during `buscar`, which is exactly the bug reported as "the character is
  invisible and it wasn't where they put it": nothing was misplaced, it simply
  was not painted, so the search was of an empty landscape. It is drawn small
  and in the scene's own palette — hard, which is the game — and after
  `PISTA_MS` a ring narrows around it, plus a `calor()` chip (frío / templado
  / caliente / ¡Casi!) on every miss, because a search with no feedback at all
  is not difficulty, it is a blank screen.
  Four more things:
  - **The target is shown as a SE BUSCA poster** (`cartel()`), drawn with
    `pintaCartel` on its own small canvas. The description is not enough; you
    search for a figure.
  - **The magnifier (lupa) redraws the vector scene at 2.5×** inside a clipped
    circle rather than scaling the bitmap, so it stays sharp.
  - **Finding someone darkens everything around them** (`foco()`, even-odd).
  - **A rival chip shows the other player's misses and their heat**, so the
    duel feels like a race.
