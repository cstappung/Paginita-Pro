# Crear un juego nuevo — checklist

Read this before adding a game, so the integration points don't have to be
rediscovered with grep. Lists are taken from the commits that added Trigon
(club, #158) and Boxhead (room, #119): `git show --stat ad7c666` and
`git show --stat 4a430b3` show the real diffs if something here is unclear.

Also read: `colabtex/src/juegos/CLAUDE.md` (architecture and the mute/volume
rule), `docs/claude/juegos/perfiles-y-economia.md` (logros, coins, ranking),
and the doc of the most similar existing game (docs map in the root
`CLAUDE.md`). Copy that game's wiring rather than inventing a new one.

Most lists below are **hard-coded regexes or arrays naming every game**.
Missing one fails silently (no ranking, no coins, a record rejected by the
rules), so go through all of them. After the list: `grep -rn "<similar-game-id>"
colabtex/src firebase juegos.html colabtex/tests` must find your id in the same
places.

## First decide which kind it is

| Kind | Where it lives | Example to copy |
|---|---|---|
| **Room game, painted by the page** (turn-based, multiplayer) | `colabtex/src/juegos/<id>.js` + reducer in `motor.js` | Reversi, Cuadritos (simple); UNO, Flip 7 (secret hands) |
| **Room game in an iframe** (real time, canvas/3D) | `juegos/<id>/` + postman `colabtex/src/juegos/<id>.js` | Boxhead, Yemas, Clue |
| **Solo Club game** (single player, ranking) | `juegos/club/<id>/`, plain files, no build | Trigon, 2048 (simple); Metro Rush, FANAL (big) |

## Solo Club game

**The game itself, `juegos/club/<id>/`:**

- `index.html`, in this order: `../../../i18n.js?v=…`, `../../audio/mando.js?v=mando-N`,
  `../conexion.css?v=club-N`, `../../audio/volumen.js?v=vol-N`,
  `../conexion.js?v=club-N`, then its own CSS/JS with `?v=<id>-N`. Leave
  a `.scorebar` or `[data-volumen]` slot for the volume control.
- `motor.js`: UMD, pure, deterministic. Use mulberry32 from a seed and never
  `Math.random`, `Math.sin` in decisions, or wall-clock time. It must run in Node.
- `juego.js`: the screen. It reports with
  `Club.result({categoria, puntos, tiempo}, prueba)`. `tiempo` must be an
  integer ms (`Math.round`). Use `Club.inmersivo(on)` for phone mode,
  `Mando.configura(...)` for controllers, and
  `Club.guardarPartida`/`pedirPartida` if a game in progress travels across
  devices.
- Add a `CLAUDE.md` in the folder with the game's notes, and a row in the
  root docs map.

**Anti-cheat (mandatory):**

- `colabtex/src/juegos/solo/verifica/<id>.js` exports `PRUEBA`, `verifica`
  and `sospecha`. It replays the proof with the same `motor.js`.
- Register it in `VERIFICADORES` in `solo/verifica.js`.
- Add `docs/antitrampas/<id>.md` and a row in the table of `docs/antitrampas.md`.

**Club plumbing:**

- `solo/club-datos.js`: `categoriaClub` (which categories exist) and
  `resultadoClub` (caps, fixed `puntos`).
- `solo/club.js`: iframe `title`, iframe `height` and **bump `?v=club-N`**.

**Site, one entry per list:**

- `juegos-main.js`:
  - `ICONO_TODOS`;
  - `CLUBES`;
  - the `#solo/(…)` regex in `leerRuta`;
  - the `club-<id>` → `<id>` map in `armazon`;
  - optionally a `NOVEDADES` entry plus its `arteNovedad` line.
- `juegos/salon-datos.js`: a `SOLOS` row (`tipo: "club"`, `ruta`, `reglas`,
  `popular`, `alta`) and `COLOR_SOLO`.
- `juegos/portadas-solo.js`: the cover scene (see `salon.md` for what the
  card overlays).
- `fb-juegos.js`: the `club-(…)-` regex in `leerPopularidad`.
- `juegos/discord.js`:
  - the `CLUBS` entry;
  - the regex in `categoriaLegible`;
  - a line in `marcaSolo`.
- `juegos/ranks.js`: `EXTRA` (name and colour) and a `SOLO` entry (rows and
  `cat`).
- `juegos/logros.js`:
  - ten logros in `SOLO.<id>`, each with `s: d => …` over its marks;
  - `SOLO_PREFIJO`.
- `juegos/logros-vista.js` `EXTRA`, `monedas-vista.js` `NOMBRES_CLUB`,
  `perfil-tarjeta.js` `NOMBRES_EXTRA` plus a line in `valorMarca`.
- `juegos/monedas.js`:
  - `NIVEL.<id>` (ten digits 1–4, in the order of `LOGROS.<id>`);
  - `RECORD`;
  - `PAGO_CLUB`;
  - `JUEGOS_CLUB`;
  - optionally `extraRecord`.
- Optional champion frame:
  - `MARCOS` in `perfil-tarjeta.js` (`t<id>`);
  - its drawing in `DIBUJOS` in `marcos-animados.js`.
- The 📖 manual:
  - `reglas.js` (what the engine does);
  - `reglas-ejemplos.js` + `reglas-ilustraciones.js` (local SVG, no fetch).

**Rules (Firebase):**

- `firebase/database.rules.json`: widen the category regexes of `soloRanks`
  and `soloPruebas`, plus the `puntos` cap if needed, and the `$juego` regex of
  `clubJugadas`.
- Add a dated note to `firebase/CONFIGURAR-FIREBASE.md`: the rules must be
  **re-published by hand**.

**Tests:**

- Add `colabtex/tests/<id>.test.cjs` for the engine and the verifier, and add
  it to `test:juegos` in `colabtex/package.json`.
- Add the id to the lists in:
  - `antitrampas.test.cjs`;
  - `logros.test.cjs` (`juegos`);
  - `controles.test.cjs` (`PROBADOS`);
  - `salon.test.cjs` (guest `rutaLibre`).

## Room game

- `juegos/motor.js`:
  - a `JUEGOS.<id>` row (`nombre`, `lema`, `color`, `minimo`, `cupo`,
    `alta`);
  - the reducer `red<Id>`, plugged into `reducir()`;
  - its case in `meToca()` if «your turn» is not the generic one;
  - its case in `progreso()` (endgame music);
  - optionally a case in `minimoDe()`.
  The reducer is pure. Moves are append-only entries, and the reducer only
  accepts legal ones. Secrets go through `compromiso`/private seeds; see how
  cartas, UNO or Flip 7 do it.
- `colabtex/src/juegos/<id>.js`: the screen, `crear<Id>(ctx)` →
  `{montar, actualizar, destruir}`.
  - Repaint by signature.
  - Expose `ocupado()` if the last move animates.
  - Add a heartbeat and a write timeout if the screen sends anything by itself.
  - Spectators come in as `ctx.mirando`.
- `juegos-main.js`:
  - the import and `FABRICAS`;
  - `ICONO`;
  - `OPCIONES.<id>` (room options; never call one `modo` unless the rules'
    `modo` whitelist gets it);
  - `modoReglas`;
  - `PAUSA_FIN`;
  - the cover in `arteJuego`;
  - optionally `NOVEDADES`.
- `juegos/salon-datos.js`: `GENERO`, plus a `SOLOS` row `tipo: "bots"` if
  there is a bot practice.
- `juegos.html`: the cover CSS (`.jg-art-<x>`). Any light surface also needs
  its dark twin in the `html[data-tema=oscuro]` block.
- `juegos/logros.js`: six live logros in `SALA.<id>` (the four of the
  `ranks` row are automatic).
- `monedas.js`:
  - `NIVEL.<id> = F + "six digits"`;
  - `PESO.<id>` (1 for a short duel up to 3 for Catan).
- Champion frame:
  - `MARCOS` (`t<id>`) in `perfil-tarjeta.js`;
  - its drawing in `marcos-animados.js` `DIBUJOS`.
- `reglas.js`, with one tab per variant, plus `reglas-ejemplos.js` and
  `reglas-ilustraciones.js`.
- Sound goes through `sonido.js` (`busFx` or the music bus), never straight to
  `ctx.destination`.
- `firebase/database.rules.json`:
  - add `'<id>'` to the `juego` whitelist of `partidas`;
  - add it to the `$juego` regex of `logros`.
  - Add a note in `CONFIGURAR-FIREBASE.md`.
- Tests: `colabtex/tests/<id>.test.cjs`. Play robot games to the end through
  `reducir`, check a vote-out behaves as an abandono, and add the test to
  `test:juegos`. Add the id to `controles.test.cjs` `PROBADOS`.
- Iframe games additionally:
  - the frame's `index.html` loads `i18n.js`, `mando.js` and `volumen.js`;
  - the postman forwards only log entries by key;
  - movement goes over `malla.js` (WebRTC), **never** through RTDB at frame
    rate (that drained the daily download quota once).
- Add the game's doc (`docs/claude/juegos/<id>.md`, or `juegos/<id>/CLAUDE.md`
  for an iframe game) and its row in the root docs map.

## Before pushing

```
cd colabtex
npm run build           # regenerates bundles, controles-datos.js and stamps ?v=
npm run test:juegos     # node --test over the games' tests
```

- Commit the generated `*-app.js` and `controles-datos.js`.
- Remind the user, in the PR or the reply, that the Firebase rules must be
  re-published in the console.
