# Spicy — notes for Claude

Screen: `colabtex/src/juegos/spicy.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

**Spicy (`spicy`) deals like UNO.** Each player draws from a private deck
(`cartaSp`, seed + a `mezcla` from a commit-and-reveal start). A card is
played face down as a hash (`tapaSp`) with a claim. When someone doubts it,
the owner's screen reveals it by itself (`{t:"revela"}`) and the reducer
checks the hash. The World's End card cannot live in anyone's private deck,
so it is a public counter of cards drawn after the deal (`SP_MUNDO`, per
player count). `auditaSpicy` replays the game at the end, as in UNO.
