# Batalla de Rock — notes for Claude

The owner's «BATALLA DE ROCK» (Three.js) as the background of PRO HERO. Open
to every signed-in account (`ROCK_SOLO_ADMIN` false in
`colabtex/src/juegos/rock-datos.js`; closing it = flag true + `admins` back in
the `rock/c` and `rockLook` rules). `rockSitio.admin` means «enabled for this
account». See also `juegos/hero/CLAUDE.md`,
`docs/claude/juegos/perfiles-y-economia.md`, `docs/claude/juegos/mercado.md`.

## Files

- `catalogo.js` — **pure, no imports**: `ED_CAT` (3rd element of an option =
  legendary with factory colours), `PAL`, factory rockers, `sanitizeLook`,
  `limpiaLook`, `POOL`, `abreCaja`, `iniciales`, `lookPosible`. Shared by the
  scene, the page bundle and `tests/rock.test.cjs`.
- `escena.js` — the scene as a module, singleton; API is `rock` at the end.
  Editor DOM/CSS injected at load (`CAPA`, `ROCK_CSS`).
- `../sitio/rock.js` (frame glue), `../ui/rockero.js` («Tu rockero»).
- Three.js **0.160.0** vendored in `juegos/hero/vendor/three-0.160.0/`,
  imported by relative path (workers have no import map); the addons were
  edited `from 'three'` → `from '../../three.module.min.js'`.
- **In a song the scene runs in a worker** (`trabajador.js` →
  `rock-trabajador.js` via `npm run build:rock`) on an `OffscreenCanvas`;
  falls back to the page. The editor always runs in the page. In the worker
  (`EN_TRABAJADOR`): no DOM, size/dpr arrive in `TAM`, the loop is a timer
  (worker rAF stalls in headless Chromium).
  **After editing `escena.js`/`catalogo.js`, run `npm run build:rock`.**
- `canvas.rock-lienzo` is styled in `css/style.css`, not the scene's CSS.

## Money (all derived)

- A box: `rock/c/<uid>/<k>` = `{at, p: 500, b}`. Content =
  `cajaRock(uid, k, at, b)` (SHA-256 → xoshiro): 1/10 legendary, a uniform
  `POOL` row of that body and class, then colours (`INV_RAND`; legendaries
  only since `CORTE_CAJAS_3`).
- **`POOL` is append-only and versioned by purchase time** (`poolDe(at)`:
  `POOL_1` = 109 rows before `CORTE_CAJAS_2`, `POOL_2` = 169 before
  `CORTE_CAJAS_4`). Adding rows needs a new cut-off set after the deploy.
  Never reorder: it would change boxes already opened.
- **Synyster** guitar: outline `SYN_C` traced from the owner's photo; stripes
  are a `ShapeGeometry` with an `alphaMap` (`RAYAS_Y`) in `guard`; `metalMat`,
  below bloom (common, not legendary).
- A legendary's glow follows its variant: `legMat(kind, base, glow)` through
  `vivo(x, def)` (factory glow only if the colour is too dark).
- Face and hair pieces are in the boxes too (`INV_CATS` with `cara: true` and
  a `ruta`, `cols: []`). «nada» options (`esNada`) are free. Use
  `rutaInv(k)` / `catDeRuta(path)` / `invVarL(L, k)`, never `L[k].type`.
- `economia()` event `rc`: pays `cajaRock`; an exact repeat of a starter or an
  owned piece refunds `REEMBOLSO`; otherwise copy `rk:<uid>~<k>` in `e.rocas`.
  Starters (`iniciales`) belong to everyone and cannot be sold.
- Market: `rk:` copies list like `ob:`/`ma:`; a listed piece cannot be worn.

## The rocker

- Saved in `rockLook/<uid>` (JSON string ≤ 4000). Re-checked where seen
  (`lookVisible` = `limpiaLook` + `lookPosible`).
- The page (`crearRockHero` in `hero.js`) sends the frame `rock` =
  `{admin, inv, look, looks}` and answers `rock-pide` (`caja`, `guarda`,
  `vende`, `mercado`), re-checking against the full economy.

## In a song (`session.js`: `_preparaRock`, `_pulsoRock`, `_rockEvento`)

- `settings.fondoRock` (default on, never on phones).
- The choreography (63 bars, 140 BPM) follows the real chart:
  `pulso({beats})` → scene time (`vivoMt`, bars 5–59 loop); going back resets
  the riff pointers (`battle.rewound`).
- The song waits for the stage: `rock.enVivo()` compiles every shader with
  hidden objects made visible (cap 20 s). **A new effect must be added to
  `enVivo`'s warm-up list or it hitches the first time.**
- Star Power from the real meter: `rock.carga(q)`, `rock.poder(q, on)`.
- Rests (`ritmo.js` `descansos`): `pulso({toca})` takes the strumming hand
  off. A chart solo forces the 'solo' section.
- The guitarist strums with the real notes: `pulso({golpes})` `{l, a, d}`;
  without them (editor, demo) the old riff loop plays.
- The crowd (`Crowd`, instanced) reacts to `humor` (recent accuracy).
- Solo: rocker centre stage, `hype('racha'|'falla'|'solo')`. Battle: you
  left, rival right; momentum = score difference. Rooms of 3–8: the rest are
  built light (`LIVIANO`: no outlines, no shadows).
- Quality (`NIVELES`, `CAL`, `regula`): the governor reads the game's frame
  interval (`dtJuego`) and drops levels; at the last one it may ask PRO HERO
  to turn the background off (`alDemasiado`).
- `FUEGO`: the stage heats up with `fuegoDe(engine)` (levels at 0.3 / 0.55 /
  0.78 / 0.94: phones, lasers, strobe/pyro, fireworks).
- Lights follow the song (`MUS`, `analizaMusica`); each pulse sends the song
  second as `seg`, **never `t`** (worker messages use `t` for their type).
- Framing: single player puts the rocker in the left third (`SOLO_CORRE`).

## Thumbnails (`MINI`, `miniHaz`, `FOTOGRAFO`)

- Every box piece has a picture (default rocker wearing it, framed with
  `ED_FOCUS` + `MINI_ZOOM`), shot **in a worker** (photographer mode of
  `rock-trabajador.js`); fallback `miniProcesa`, one every 3 frames.
- Cached in localStorage under `claveMini(v)` (`rock-mini-7:<id>`): **bump the
  number when the rocker's look changes**.
- Outside the game: `colabtex/src/juegos/rock-fotos.js`, fallback
  `rock-visor.html`.

## Body, shading and clothes

- **Shoulders**: the torso profile (`K` rows in `buildBodySrc`) keeps its
  width up to the shoulder and slopes to the neck like a trapezius, ending at
  y ≈ 0.61. Raising those rows or `shY` on the male brings back the "coat
  hanger". The female shoulders are deliberately high (owner's call): rows reach
  ≈ 0.625, `shY` +0.066, with a long thin neck rising from them. Arm radius and
  `shY` are tuned together so the top line is monotonic where torso meets arm
  (`herramientas/mide.cjs` prints it): a thicker arm or lower `shY` shows a knob.
  `torsoW`'s neck weight starts at 0.575 to match and falls off with `|x|`.
  The chest→arm weight (`u`) spreads over the whole deltoid (0.175 of `s`);
  the arm outline fades at the cap (`olw`).
- Clavicles and sternal notch are bumps in `feat()`; their height `yc` must
  move with the shoulder rows.
- The head is scaled (`head.scale` 0.9, before `root.scale`; hair collision
  radii follow it); `BASE_BUILD.neck` shortens the neck (0.86 with the old
  neck read as a pinhead on a pole). `BASE_BUILD` is narrow; Rex and Kid carry their
  own build.
- Female torso rows are twice as dense above y 0.48 (and 80 columns): clip
  edges of tank/crop straps came out as staircases on the sparse neck rows.
  The female arm joint sits inside the torso (`shX` 0.86, small
  cap `cH`) so the shoulder silhouette is the torso's, not a ball on the arm.
  Female shoulder normals (arm cap and trapezius) are blended toward a common
  centre at the end of `buildBodySrc`: two meshes meeting there showed a
  shading crease. Clothes get a soft highlight on each bust (`bustHi`):
  multiplying a dark tone is invisible on black.
  The crop's straps run over the middle of the trapezius (|x| 0.088–0.106):
  hugging the neck they made it a straight column between two bands. Female
  neck: `neck` −0.005, half-width 0.034. The choker tilts down slightly in front
  (`yA`); its charm takes the z of its own height (the neck flares below it).
  The guitar strap goes over the baby collar (`conCuello`).
- Things placed on the shoulder ask `topY(x)` (strap, studs).
- Skin uses `GRAD_SOFT` (smooth ramp); clothes `GRAD_ROPA`; thin brown
  outline (`CONTORNO`).
- Rim light (`rimShader`): `toon()` adds it only while a `Rocker` is being
  built; not on skin. `clipMat` and `bustMat` chain the base material's
  `onBeforeCompile`.
- Hair is `hairMat`; locks carry a `hu` attribute (`ribbonGeo`) for fine
  strands. The cap has none (a strand texture stretched into blotches).
- Hair lock roots must start **inside** the cap (`sp(a, e, 0.9)`): blunt
  root ends on the surface showed as flaps and dark jagged patches. The top
  layer, bangs and cap share one mid tone (`HX`): locks cross each other and
  with two colours every crossing was a jagged patch.
- The bust crease shade skips the arm (rest pose falls inside the ellipse).
- Stubble is soft blobs along the jaw (a filled polygon read as a mask or as
  dirt); keep them inside `FACE_UV.X`.
- Jacket and tee stop below the neck base (y ≈ 0.6): clipped on the neck
  rows the edge is a staircase.
- **Clipped clothes need near-linear clip functions** (`clp` is interpolated
  per triangle; steep `smooth()` curves come out as a staircase). Tank and
  crop straps are `min(max(a, b), …)` of linear pieces.
- The leather jacket's lapels are a body shell (third piece of
  `TOPS.leather`), not rigid boxes.
- The stubble shadow fades before `FACE_UV.X` (past it the texture's last
  column repeats as streaks).
- Legendary shaders live in `LEG_GLSL`; the aura is dim (×1.2) so bloom does
  not white out hair and face.

## Animation (`animGuitar`, `applyPose`)

- Standing height is `PARADO` (hipDrop −0.072); at 0 it was a squat.
- Groove has three styles (`st.gr`), all from `K.beat`. Body tempo is capped
  by `RITMO` (`K.gb` = beat / `RITMO.d`); `addMove` stretches spins and jumps.
- The body shows what is played (`rasg`, `acento`, `sus`, `dens`).
- Feet are planted in world space (`L.w`, `L.paso`); hips never rise above
  what the legs reach (`LEG_MAX`).
- Fingers blend toward poses (`setHand`). The raised fist uses `poleAlto`
  (the strumming pole made a chicken wing). The singer's mic hand targets the
  wrist (`S.micGrip`) and is oriented with `handFrame`.
  The fretting hand's wrist sits below and behind the neck (`FRET_W`), palm up
  (`HAND_G[0]`), pose `traste` (fingers arch onto the board, thumb behind the
  neck); a third value in a `HAND_POSES` entry is the last phalanx (thumb:
  its turn toward the palm). The palm tube must close to a point (`cz`): a
  tiny hole showed the outline as a dark speck on the knuckles.
- `victory` moves the guitar with `gpx/gpy/gpz`, not by rotating it.

## Traps

- In the editor the rocker is still (`st.quieto`), and the crowd is hidden.
- The editor needs `battle.start()` to have run once (`rock.editor` does it).
- Headless Chromium uses SwiftShader: screenshots need 10–20 s.
- Material caches (`toon`, `legMat`) key textures by uuid **before**
  `JSON.stringify`.
