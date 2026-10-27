# Juegos — the market (🏪 Mercado) and the Mascotas viewer

`colabtex/src/juegos/mercado.js` (DOM) and `mercado-datos.js` (pure). The 3D
viewer is `visor-mascota.js` + `juegos/mascotas/visor.html`. Coins and
`economia()` are in `perfiles-y-economia.md`; PRODROP in
`juegos/prodrop/CLAUDE.md`; Mascotas in `juegos/mascotas/CLAUDE.md`.

**One market for both games**, a tab of its own: `#mercado`,
`#mercado/prodrop`, `#mercado/mascotas` (the sub-route is in
`state.perfilUid`, and it is part of the render key). It used to live inside
the PRODROP iframe. The nodes are the same, `mercado/o` (listings) and
`mercado/t` (trades), with the same guarantees:

- `x` and `v` are each written once and exclude each other;
- the replay accepts only a listing whose seller owns the copy;
- an unfunded purchase is `impaga`.

Serie 01 (Profes) cards exist only for accounts on the admin's list
(`juegos/prodrop/CLAUDE.md`): `fichaCopia` hides them from everyone else,
and they trade only between two accounts that both see the series.

**Copy types** (`leeCopia`):

- a card is `<uid>~<pack>.<i>`, exactly as before;
- an object is `ob:<uid>~<gift key>`;
- a pet is `ma:<uid>~<adoption key>`;
- a Batalla de Rock piece is `rk:<uid>~<box key>` (visible to all;
  `veRock()` hides it only if `ROCK_SOLO_ADMIN` is set again;
  `juegos/hero/js/rock/CLAUDE.md`).

Old listings never change meaning, and the rule regex accepts all three.
A rock piece is pictured with its real photo (`imagenRock`, from
`rock-fotos.js`: a worker running the rock scene, never three.js on the
page), with the category emoji only until it arrives.
Starter items have no copy key and cannot be listed.

**What the page does and does not do.**

- The market buys, withdraws, proposes, accepts and closes trades, one write
  at a time. Each write is re-checked against `economia()` with
  `puedeComprar`/`puedeProponer`.
- Selling: the **🏷️ Vender** tab lists `intercambiables` (everything of
  yours not listed; starter items have no copy) with a price and a button,
  filtered by the game selector; `accion("vender")` does the same checks as
  the games' postmen (owner, not listed, 1–100 000, not `parada`) and
  withdraws a listing the replay doesn't accept. Each game also sells from
  its own screen: a card from its zoom in PRODROP, a pet or an object from
  the Mascotas `SellDialog`, a rock piece from the rocker editor. People
  didn't find those, hence the tab.
- Your own listing still shows, tagged «Tu oferta». Hiding it made sellers
  think the listing never reached the store.
- **Pet cap.** Buying a pet with 6 already owned, or a trade that leaves
  anyone with 7, does not happen. The replay marks the sale `rechazada`
  (no charge, no stop), and the page refuses it before writing.
- A listed pet travels with its state: the buyer's postman copies the
  seller's `mascotasEstado` (see Mascotas). What it wore stays with the
  seller.

**Filters change with the selection**:

- **Todo · PRODROP · Mascotas**, and inside Mascotas
  **Todo · Objetos · Bailes · Mascotas**;
- cards: collection, 4-tier rarity, graded, minimum grade;
- Mascotas: common/legendary, slot, species, stage. Stage comes from the
  pet's state, read **by key** from its current owner, once per session.
- Sort and search are shared. The search also matches a pet's name.

**Cards look alive** (`cartaViva` in `mercado.js`, styles `.jg-mk-cv` in
`juegos.html`).
- The grid shows `miniCarta` in a dark showcase lit in the rarity colour.
  Effects add up by rarity:
  - every card tilts toward the pointer, with a reflection that follows it;
  - rare: a band of light sweeps across;
  - epic: rainbow holo and sparkles;
  - legendary: also an iridescent copy of the image and rising sparks.
- A graded card sits in its plastic case, with the grade on the label.
- Touch only scrolls (no tilt). `prefers-reduced-motion` stops all of it.
- **The detail shows the real card**: PRODROP in **visor mode**,
  `juegos/prodrop/index.html?v=pd-N&ver=1&o=&k=&i=&at=[&gr=1][&rr=id.g.w]`.
  - It is the opener's own `makeCard` with its particle aura, wear and
    slab, on a transparent background. It neither talks to the postman nor
    plays sound.
  - The showcase stays underneath until the iframe loads.
  - `PD_V` must match the opener's `?v=`.
  - A reroll needs `w`, so `copia()` in `prodrop-cartas.js` now carries it.

**Thumbnails without three.js in `juegos-app.js`.**

- Cards use `miniCarta`.
- Objects and pets are photographed by the **viewer**:
  `juegos/mascotas/visor.html` loads the same `app.js` as the game, so a
  single file is cached for both, with `<body data-modo="visor">`.
- A hidden «fotógrafo» iframe takes `fotos` requests and answers one PNG
  plus the swatch colours per item. It uses `ui/thumbs.ts`'s single
  renderer. A pet is posed with the game's `Animator`: a fresh rig has its
  tail straight up and every face expression on at once.
- Photos are cached in memory and in **localStorage** (`mc.foto.<version>.<key>`,
  the last `MAX_GUARDADAS` = 48 in `mc.fotos`, oldest out first or when
  storage is full; another viewer version's photos are dropped). They used
  to live in `sessionStorage`, so every new tab redid them all.
- The iframe is same-origin, so **it runs on the page's main thread**: one
  photo is a 100–700 ms task that cannot be split. `visor-mascota.js`
  therefore opens the iframe and asks for photos **one at a time**, only
  with the page idle (`requestIdleCallback`) and no scroll for `CALMA_MS`
  (600 ms). Sent all at once, the salón's Mascotas strip froze scrolling for
  a minute. The iframe closes itself after 20 s idle.
- Until a photo arrives, or without WebGL, the emoji and the ★ show.
- The **live** view (`montaVisor`) is one iframe at a time, at 12 fps.
  It pauses off screen (IntersectionObserver) and in a hidden tab, and it
  is still under `prefers-reduced-motion`. Mounts form a stack: a newer one
  takes the iframe, and closing it gives the iframe back to the one below
  (the profile card over the profile page). Close your own mount with the
  handle `montaVisor` returns, not with `cierraVisor`.
- The iframe needs `color-scheme:normal`: with the page dark and the viewer
  light, Chromium paints the iframe opaque white. An offer's detail shows the object spinning or the pet idling.
  A dance offer shows a generic hen dancing it.

Tests: `tests/mercado.test.cjs` (rows, filters, cap, trades of the three
types). The Mascotas half of `economia()` is in `tests/mascotas.test.cjs`.
