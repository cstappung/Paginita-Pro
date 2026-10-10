# Mascotas — notes for Claude

3D virtual pets inside Juegos (tab 🐣 Mascotas, `#mascotas`). Shared architecture in `colabtex/src/juegos/CLAUDE.md`. Coins, `economia()` and the profile in `docs/claude/juegos/perfiles-y-economia.md`. The market both games share is in `docs/claude/juegos/mercado.md`. Everything here is written in Spanish.

**Where it lives.**
- The source is TSX in `colabtex/src/mascotas/`: React 19, React Three Fiber/drei, three.js and zustand. It came from the standalone «Mascota» project; its Vite, PWA, studio and dev buttons were dropped.
- `npm run build:mascotas` (part of `npm run build`) bundles it with esbuild into `juegos/mascotas/app.js` + `app.css`. `stamp-version.js` stamps both in `index.html`.
- The frame is loaded like PRODROP's: the postman `colabtex/src/juegos/mascotas.js` (`crearMascotas`) mounts it full-window (`html.jg-mascotas`). It sends `datos` and `tema`, and does every write the frame asks for (`pide`), one at a time, re-checked against the complete read.
- **The frame never touches Firebase.** Bump `?v=mc-N` in the postman when `index.html` changes.
- `index.html` loads `i18n.js`, `mando.js` and `volumen.js` before the bundle. The volume control is drawn by the `Volumen` component in the top bar through `VolumenJuego.control`. All audio is Web Audio on `ctx.destination`, which `volumen.js` wraps, so the site's mute and volume govern it.

**The pure motor is `juegos/mascotas/motor.js`** (UMD, `MascotasMotor`), shared by the page, the frame and the tests, like `ProdropMotor`. It holds:
- the gift `POOL`, **append-only**: a gift is an index inside its class, so reordering changes past gifts. A test pins it to the TS catalogue.
- prices (`PRECIO`, the same ones the rules demand), `MAX_MASCOTAS` (6) and `INICIALES`.
- `regalo(uid, k, at)`: SHA-256 → xoshiro128**, 600/10 000 legendary, then the item, then `tint`.
- `semillaGenes(uid, k, at)`. There is **no `Math.random` in anything that is saved**: plumage and coat come from the adoption (`genesDe` in `game/look.ts`), so they do not change when the pet changes owner.

**Money.** The game pays no coins. The minigame and the `coins` of the care actions are gone. Coins enter only through market sales. The writes, all one-shot and never deleted, are replayed by `economia()`:
- `mascotas/a/<uid>/<k>` = `{at, e, p}`: an adoption. The account's first one is free (the rule checks that `mascotas/a/<uid>` did not exist before; the replay counts `intentos` the same way), the rest cost 1000. Over the cap of 6 owned pets it simply does not happen.
- `mascotas/r/<uid>/<k>` = `{at, p: 500}`: a gift. Its content is derived from the write.
- `mascotas/c/<uid>/<k>` = `{at, k, p, n?, m?}`, with `k` one of:
  - `comida` (20 × `n`);
  - `pocion` for pet `m` (1000; it freezes that pet for good and travels with it);
  - `fondo-<id>` (10–25, once per account);
  - `adios` (free: the pet leaves the account and frees its slot).
- Copy keys are `ob:<uid>~<k>` for an object and `ma:<uid>~<k>` for a pet. Starter items have no key: everybody owns them, and nobody can sell them.

**State is not money.** `mascotasEstado/<uid>/<origen~clave>` (v1, `game/estado.ts`) holds stage, growth, stats, `ls`, sleep, `w` (item uid per slot) and `d` (furniture, rotation in octants).
- The owner writes it on every action, throttled to one write per pet every 4 s (`GUARDA_MS`) and flushed on `visibilitychange`, never per tick. Stats are derived from `ls` with `tick`.
- Others read it **by key** only, never the collection: that is the download cap rule.
- A pet bought or received has no state in the new account. The postman copies the latest previous owner's state (from `historial`), without `w`/`d`, which belonged to the seller.
- **Honest limit:** stage and growth are client-claimed, like club marks. A console can grow its own pet; it cannot mint items, coins or potions. The rule only lets the stage move forward.

**Preferences** go to `users/<uid>/mascotas`: light, background, dance bar, and `usadas`, the rations eaten (a transaction +1 per handful). Food stock = rations bought (replay) − `usadas`. FPS and mute stay in `localStorage`.

**Balance.** Growth was cut to 1/20 (`GROW_PER_ACTION` 0.05, `GROW_PER_POINT` 0.005). The «+N 🌱» shows hundredths. `sinPremio` is the old `unpaid`: dancing while already happy still raises stats but gets no per-action growth.

**While listed in the market** a pet cannot be cared for, dressed or given the potion, and an item cannot be used. Listing a pet strips what it wears (it stays the seller's). Selling an item takes it off whoever wore it. `onlyUsable` drops worn items that were sold or listed.

**Theme.** The postman forwards `data-tema`. `app.css` has an `html[data-tema='oscuro']` block: neutral surfaces go dark and the ink goes light, while coloured buttons keep dark ink on their pastel.

Tests: `colabtex/tests/mascotas.test.cjs` compiles `src/mascotas/**/*.test.ts` with esbuild against a fake `vitest` (describe/it/expect over `node:test`). It also tests the motor and the Mascotas part of `economia()`. The rules are covered in `test-rules.mjs`.
