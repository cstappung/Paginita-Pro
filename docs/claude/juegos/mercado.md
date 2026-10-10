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

**Copy types** (`leeCopia`):

- a card is `<uid>~<pack>.<i>`, exactly as before;
- an object is `ob:<uid>~<gift key>`;
- a pet is `ma:<uid>~<adoption key>`.

Old listings never change meaning, and the rule regex accepts all three.
Starter items have no copy key and cannot be listed.

**What the page does and does not do.**

- The market buys, withdraws, proposes, accepts and closes trades, one write
  at a time. Each write is re-checked against `economia()` with
  `puedeComprar`/`puedeProponer`.
- Selling happens in each game: a card from its zoom in PRODROP, a pet or an
  object from the Mascotas `SellDialog`.
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

**Thumbnails without three.js in `juegos-app.js`.**

- Cards use `miniCarta`.
- Objects and pets are photographed by the **viewer**:
  `juegos/mascotas/visor.html` loads the same `app.js` as the game, so a
  single file is cached for both, with `<body data-modo="visor">`.
- A hidden «fotógrafo» iframe takes `fotos` requests and answers one PNG
  plus the swatch colours per item. It uses `ui/thumbs.ts`'s single
  renderer. A pet is posed with the game's `Animator`: a fresh rig has its
  tail straight up and every face expression on at once.
- Photos are cached in memory and in `sessionStorage`. The iframe closes
  itself after 20 s idle.
- Until a photo arrives, or without WebGL, the emoji and the ★ show.
- The **live** view (`montaVisor`) is one instance at a time, at 12 fps.
  It pauses off screen (IntersectionObserver) and in a hidden tab, and it
  is still under `prefers-reduced-motion`. Mounting another one closes the
  previous. An offer's detail shows the object spinning or the pet idling.
  A dance offer shows a generic hen dancing it.

Tests: `tests/mercado.test.cjs` (rows, filters, cap, trades of the three
types). The Mascotas half of `economia()` is in `tests/mascotas.test.cjs`.
