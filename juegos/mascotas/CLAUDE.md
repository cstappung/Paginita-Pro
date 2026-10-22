# Mascotas — notes for Claude

3D virtual pets inside Juegos (tab 🐣 Mascotas, `#mascotas`). Shared architecture in `colabtex/src/juegos/CLAUDE.md`. Coins, `economia()` and the profile in `docs/claude/juegos/perfiles-y-economia.md`. The market both games share is in `docs/claude/juegos/mercado.md`. Everything here is written in Spanish.

**Where it lives.**
- The source is TSX in `colabtex/src/mascotas/`: React 19, React Three Fiber/drei, three.js and zustand. It came from the standalone «Mascota» project; its Vite, PWA, studio and dev buttons were dropped.
- `npm run build:mascotas` (part of `npm run build`) bundles it with esbuild into `juegos/mascotas/app.js` + `app.css`. `stamp-version.js` stamps both in `index.html`.
- The frame is loaded like PRODROP's: the postman `colabtex/src/juegos/mascotas.js` (`crearMascotas`) mounts it full-window (`html.jg-mascotas`). It sends `datos` and `tema`, and does every write the frame asks for (`pide`), one at a time, re-checked against the complete read.
- **The frame never touches Firebase.** Bump `?v=mc-N` in the postman (`mascotas.js`) and in `visor-mascota.js` when `app.js` changes: `index.html` and `visor.html` are restamped, but the iframe URL that loads them is not.
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
- `recibe` must `tick` every pet it builds. Saved stats are as of `ls`, and without the tick a pet left for hours showed its old full bars until the first care action or `App`'s 10 s interval.
- Others read it **by key** only, never the collection: that is the download cap rule.
- A pet bought or received has no state in the new account. The postman copies the latest previous owner's state (from `historial`), without `w`/`d`, which belonged to the seller.
- **Honest limit:** stage and growth are client-claimed, like club marks. A console can grow its own pet; it cannot mint items, coins or potions. The rule only lets the stage move forward.

**Preferences** go to `users/<uid>/mascotas`: `oscuras` (the pets with their light off), background, dance bar, and `usadas`, the rations eaten (a transaction +1 per handful). Food stock = rations bought (replay) − `usadas`. FPS and mute stay in `localStorage`.

**The light is per pet** (`oscuras`, `useLuz(id)`): turning it off for one must not darken the others, and the corral is always lit. The old single `luz: false` is read once as «all dark»; the postman now always writes `luz: true` so it never applies again.

**The top-bar ←** goes back to the corral while a pet is open, and to Juegos only from the corral.

**Balance.** Growth was cut to 1/20 (`GROW_PER_ACTION` 0.05, `GROW_PER_POINT` 0.005). Hatching (egg/box → baby) needs 10/3 growth, a third of the old 10. Stats drop at 2.5× the original rate (`DECAY_PER_HOUR` 17.5/12.5/7.5/10). The «+N 🌱» shows hundredths. `sinPremio` is the old `unpaid`: dancing while already happy still raises stats but gets no per-action growth.

**While listed in the market** a pet cannot be cared for, dressed or given the potion, and an item cannot be used. Listing a pet strips what it wears (it stays the seller's). Selling an item takes it off whoever wore it. `onlyUsable` drops worn items that were sold or listed.

**In the salón.** A strip of the latest legendary gift items and a Novedades entry (`docs/claude/juegos/salon.md`).

**In the profile.** A pet (and a dance) can be shown on the profile card and page, chosen in the profile editor's «Mascota» tab. Details in `docs/claude/juegos/perfiles-y-economia.md`. The live view asks the viewer for `cerca` (1 the profile hero, 2 the mini card), a closer camera for a small box. The postman reports every state it saves (`alGuardar`), so your own card shows new clothes at once.

**The Pueblo (Pet Society style).** The corral's 🏘️ opens `ui/Pueblo.tsx`, a shared 3D plaza; pure logic in `game/pueblo.ts` (bounds, obstacles, gestures, cariños), the plaza model in `scene/plaza.ts`. No coins move here.
- **The plaza.** You tap the floor and your pet walks there; `aPiso` keeps the target inside the plaza and out of the obstacles (`OBSTACULOS` is the same list the scene draws). Walkers use the animator's own walk (`PetView` `walk`/`pos` → `Animator.goTo`, local space = world ÷ `stage.scale`); eggs and boxes have no `SPEED`, so `Andante` moves them with hops. The camera follows your pet only when the whole plaza does not fit.
- **Presence** is `mascotasPlaza/<uid>` = `{m, x, z, at, em?, ea?, b?, t?, ta?}`: the destination, never per frame. The postman writes it with a 0.9 s respite, a 45 s heartbeat and `onDisconnect` remove, and deletes it on leaving. The read rule allows only `orderByChild('at')` + `limitToLast(≤ 40)`. `query.startAt` cannot be compared in rules (the emulator denies every numeric comparison), so freshness (3 min) is filtered by the reader.
- **What arrives from others is re-checked against `economia()`** before the frame sees it: the pet must belong to whoever walks it and not be listed, worn items must still be theirs (`ropaDe`), a dance must be a starter or theirs (`baileDe`). Stage, name and clothes come from their `mascotasEstado` read by key (cached 5 min). The Vecinos list and the cariños use `quien(u, true)`: names already downloaded, without opening a profile listener (and its photo) per neighbour.
- **Visits.** «👥 Vecinos» lists every account with pets (from the economy); a pet opens `ui/Casa.tsx`, read-only: its state, clothes and furniture (only what its owner still owns), with the default meadow (the owner's background lives in private `users/<uid>`).
- **Cariños.** `mascotasCarinos/<dueño>/<origen~clave>/<visita>` = `{at}`: once per 20 h per visitor and pet, never your own, only to a pet with state. The owner's frame applies them (+8 ánimo, `conCarino`) once: the watermark `users/<uid>/mascotas/carinos` and every `at` stay in **server time** end to end (the postman also sends `ahora`), because converting to the local clock and back let a drifting offset re-apply the last one.
- **Honest limit:** positions, gestures and text are client-claimed and readable by anyone signed in, like the room chat; the text bubble is capped at 60 (rule 100).

**Theme.** The postman forwards `data-tema`. `app.css` has an `html[data-tema='oscuro']` block: neutral surfaces go dark and the ink goes light, while coloured buttons keep dark ink on their pastel.

Tests: `colabtex/tests/mascotas.test.cjs` compiles `src/mascotas/**/*.test.ts` with esbuild against a fake `vitest` (describe/it/expect over `node:test`). It also tests the motor and the Mascotas part of `economia()`. The rules (plaza and cariños too) are covered in `test-rules.mjs`.
