# Batalla de Rock — notes for Claude

The owner's «BATALLA DE ROCK» package (one `index.html`, Three.js) turned into
the background of PRO HERO. **On trial: only accounts in `admins/<uid>` see
any of it** (`ROCK_SOLO_ADMIN` in `colabtex/src/juegos/rock-datos.js`, plus
the `rock/c` and `rockLook` rules). Opening it to everyone = that flag to
false and drop the `admins` condition from those two rules. PRO HERO itself:
`juegos/hero/CLAUDE.md`; coins and `economia()`:
`docs/claude/juegos/perfiles-y-economia.md`; market: `docs/claude/juegos/mercado.md`.

## Files

- `catalogo.js` — **pure, no imports**: `ED_CAT` (per body, the 3rd element of
  an option = legendary with its factory colours), `PAL`, the factory
  rockers, `sanitizeLook`, `limpiaLook` (cleans a look written by a browser:
  only catalogue values, 24-bit colours, name ≤ 24, `ui` #rrggbb), `POOL`,
  `abreCaja`, `iniciales`, `lookPosible`. Shared by the scene, the page
  bundle (esbuild) and `tests/rock.test.cjs`.
- `escena.js` — the package's script as a module: same 3D code, minus the
  director panel, recording and localStorage. Singleton (one canvas, one
  scene per document); its API is `rock` at the end. The editor DOM/CSS is
  injected into `document.body` at load (`CAPA`, `ROCK_CSS`).
- `../sitio/rock.js` (frame glue: `rockSitio`, lazy `cargaEscena`,
  `pideRock`), `../ui/rockero.js` («Tu rockero» screen).
- Three.js **0.160.0** (the version the owner built on) is vendored in
  `juegos/hero/vendor/three-0.160.0/` (min build + the addons used) and
  imported **by relative path** (no import map: workers have none). The
  vendored addons were edited for that: `from 'three'` →
  `from '../../three.module.min.js'`. Re-vendoring needs the same edit.
- **In a song the scene runs in a worker** (`trabajador.js`, bundled by
  `npm run build:rock` into `juegos/hero/rock-trabajador.js`, loaded with the
  frame's own `?v=hero-N`) on an `OffscreenCanvas`, so the 3D never takes
  time from the game thread. `cargaFondo()` in `sitio/rock.js` falls back to
  the page when there is no OffscreenCanvas or the worker fails. The editor
  always runs in the page. In the worker `EN_TRABAJADOR` is true: no DOM
  (`$` returns a do-nothing proxy, canvases are `OffscreenCanvas`, size /
  dpr / visibility arrive as messages in `TAM`), Bangers is registered with
  `FontFace` from the Google Fonts CSS, and the loop is a **timer**: the
  worker's `requestAnimationFrame` never fired again in headless Chromium.
  **After editing `escena.js`/`catalogo.js`, run `npm run build:rock`**
  (`npm run build` does it); `tests/hero.test.cjs` checks the bundle exists.
- `canvas.rock-lienzo` is styled in `css/style.css`, not in the scene's CSS
  (with the worker that CSS is never injected and the canvas was invisible).

## Money (all derived, like Mascotas gifts)

- A box: `rock/c/<uid>/<k>` = `{at: now, p: 500, b: "m"|"f"}`, admin-only by
  rule. Content = `cajaRock(uid, k, at, b)` (SHA-256 → xoshiro, via
  `MascotasMotor`): 1000/10 000 legendary, then a uniform `POOL` row of that
  body and class, then colours (`INV_RAND`; legendaries keep factory ones).
- **`POOL` is append-only**: a box is an index into it. A new catalogue item
  goes at the end of `POOL` (the test fails otherwise); never reorder.
- `economia()` event `rc` (ORDEN 2.4): pays `cajaRock`; an exact repeat
  (same piece and colours) of a starter item or of a piece the account owns
  *at that moment* refunds `REEMBOLSO` (100/250) as `premios` and leaves no
  copy; otherwise copy `rk:<uid>~<k>` in `e.rocas`. `rocasDe(uid, d)` lists
  what an account owns now; `usuarios[u].cajasRock` the boxes it opened.
- Starter items (`iniciales`: both default looks + the three factory
  rockers) belong to everyone, have no copy and cannot be sold.
- **Market**: `rk:` copies list like `ob:`/`ma:` (rule regex includes `rk`).
  Selling is done from the editor (variant → «Vender»); buying, withdrawing
  and trading from the Mercado tab, filter «Batalla de Rock»
  (`#mercado/rock`), visible only while `veRock()` (`fijaVeRock(state.admin)`
  in `juegos-main.js`). A listed piece cannot be worn.

## The rocker

- Saved in `rockLook/<uid>` (a JSON string ≤ 4000, owner writes, anyone
  signed in reads **by key**: the room shows the rival's). It is re-checked
  where seen (`lookVisible` = `limpiaLook` + `lookPosible` against the
  owner's unlisted pieces): a sold piece disappears from the look.
- The page (`crearRockHero` in `hero.js`, used by both postmen) sends the
  frame `rock` = `{admin, inv, look, looks}` on every economy change and
  answers `rock-pide` (`caja`, `guarda`, `vende`, `mercado`), re-checking
  everything against the full economy before writing.

## In a song (`session.js`: `_preparaRock`, `_pulsoRock`, `_rockEvento`)

- `settings.fondoRock` (default on; Ajustes › Juego, the room panel and the
  pause menu — «Fondo de rock: sí/no» mounts/unmounts it mid-song). Never on
  phones.
- The scene's choreography song (63 bars at 140 BPM) is driven by the real
  chart: `pulso({beats})` maps the chart's beats to scene time
  (`vivoMt`: bars 5–59 loop) so headbangs land on the beat; going back (loop
  or the post-pause rewind) resets the riff pointers (`battle.rewound`).
- **Solo** (no other player): your rocker centre stage, singer and mic
  hidden; mood = multiplier, Star Power / streaks of 50·100 / a combo break
  ≥ 25 → `hype('sp'|'racha'|'falla')`; at `song.endTime` a title by stars.
- **Battle** (room: the first other player; local: the second player): you
  left, rival right (their `rockLook`, or a factory rocker picked from their
  uid). Momentum = score difference; Star Power and every 100 streak are an
  attack; at the end the higher score wins the K.O.
- **Quality** (`NIVELES`, `CAL`, `regula` in `escena.js`): as a background
  it was ~940 draw calls and ~775k triangles at full resolution, 60 fps, with
  4× MSAA, bloom and 2048 shadows — unplayable. Now: a fraction of the CSS
  pixels (`escala`), no MSAA, an fps cap, shadows redrawn every few frames,
  bloom only at level 0 (it was the most expensive pass), and only the front
  rows of the crowd (sorted by z). The crowd geometry has fewer segments for
  everyone (it was 315k triangles with outlines). Starts at level 1 (2 with
  alto rendimiento). The governor reads the **game's** frame interval
  (`dtJuego` in each `pulso`): below ~48 fps it drops a level; at the last
  level below ~36 fps it freezes the background for 3 s (the guilt test) and
  only if the game recovers asks PRO HERO to turn it off (`alDemasiado` →
  toast, back on from the pause menu); otherwise it stays at the minimum.
- **Framing**: single player puts the rocker in the left third
  (`SOLO_CORRE`, `setViewOffset` per shot; the highway is in the middle) and
  skips shots that can't (`SOLO_FUERA`). In battle the two highways leave the
  centre free, so shots stay centred.

## Traps

- The editor needs `battle.start()` to have run once (lights, rockers,
  director): opened cold the stage rendered black. `rock.editor` does it.
- The crowd is hidden while the editor is open (the editor camera stands
  where the crowd starts).
- Headless Chromium renders this with SwiftShader at a few fps: screenshots
  need 10–20 s of waiting, and the governor drops to the last level there.
- The material caches (`toon`, `legMat`) key textures by uuid **before**
  `JSON.stringify`: its `toJSON` runs before a replacer and turned every
  texture into a base64 data URL on each call (and warns in a worker).
