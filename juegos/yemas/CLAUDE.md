# Yemas — notes for Claude

Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`. The room postman is `colabtex/src/juegos/yemas.js`.

**Yemas (`yemas`) is a first-person shooter in an iframe, and the log only
carries deaths.** `juegos/yemas/` is its own document (Three.js from
jsDelivr through an import map, ES modules whose `?v=` lives only in that
import map, physics, bots) and `colabtex/src/juegos/yemas.js` (`crearYemas`)
is the postman, like Circuit Breakers'. Four things hold it together:

- **A death is one entry, written by whoever died**: `{t:"muere", uid,
  por, a, cab}`. `redYemas` counts `bajas`, `muertes`, `cabezas` and kill
  streaks from those, and the first to reach `meta` (10, 15 or 25, the
  room's `meta`, clamped by `metaYemas`) wins; the state freezes on that
  entry. A kill credited to oneself, to an intruder or to someone who left
  adds a death and no kill. Nobody can write a kill for themselves: the
  honest limit, said in the manual, is that a modified client could refuse
  to die.
- **Movement goes browser to browser, not through the database.** The
  frame publishes its state about twelve times a second, and the postman
  sends it over a WebRTC data-channel mesh (`juegos/malla.js`, `voz.js`'s
  sibling, signalled through the same kind of mailbox at
  `vivo/<pid>/rtc`, `fb.senalMalla`). Through RTDB this was N² downloads at
  12 Hz, with the zombies director's `zb` at 2–3 KB each, and it used up
  the daily download quota. The channel is unordered with no retransmits
  (an old state is worthless once the next one is out), negotiated with
  `id: 0` on both sides, and each attempt carries a number `k`, so ICE
  candidates from a dropped attempt are ignored. The offerer re-offers on
  failure (4 s after a channel that had opened, backing off from 10 s for
  one that never did). Spectators connect to players only. «Healthy» means
  the channel is open and the connection is not cut, not «something
  arrived recently»: a hidden tab stops sending but stays healthy, as its
  database entry used to stay.
- **There is no database fallback, on purpose.** An earlier version kept
  `vivo/<pid>/y/<uid>` as a backup for pairs without a channel, and
  listening to it was exactly what drained the quota. It is gone from the
  client, and the rules refuse any write there (`y/$u` `.validate: false`,
  deletes still allowed to clean up old leftovers), so not even a stale
  cached client can bring it back. `juegos/yemas-red.js` (pure, tested by
  `tests/yemas-red.test.cjs`) decides the rest:
  - **A pair without a channel is served by a third peer.** Every peer
    announces, once a second and whenever a channel changes, whom it has a
    healthy channel with (`{y:"ok", l}`). States travel as `{y:"e", o, e}`.
    When the state of O reaches me *directly* and a peer T I am connected
    to has announced it lacks O, I forward it to T, but only if I am the
    lowest uid among the peers connected to both (`destinos`). Two who both
    think they are the chosen one just send T a duplicate, which the `q`
    drops. Only direct states are forwarded, so it is one hop and never
    loops. Spectators relay too.
  - **With nobody in common there is no way to see each other** (a duel
    between two networks that refuse a direct connection). The room says
    so above the frame after `AVISO_MS` (`inalcanzables`, `pintaRed` in
    `yemas.js`), and tells apart someone who left the mesh («no está en la
    partida») from a network problem.
  - The frame sees, per egg, the highest `q` (a per-sender counter that
    only grows), direct or relayed. It stays visible while there is a path
    (a direct channel, or a connected peer announcing one) and for
    `PUENTE_MS` after losing it. A closed tab loses every channel, which is
    how zombies still change director.
  - Before leaving, states are **thinned** (`adelgaza`): hits travel only
    their first `VIDA_GOLPE` ms, and `s`/`n`/`x2` only their first
    `VIDA_SUCESO`. A single burst used to ride every state at 12 Hz until
    the next one. `ep` is never thinned, because the frame removes the
    spatula when it is missing.
  - Packets without `y` come from the previous version (a bare state) and
    count as the sender's own.
  - `rtc` has its own rule, so a spectator can sign up and sign its
    messages (`de === auth.uid`). Until the rules are re-published, a
    spectator cannot join the mesh and sees nothing.
- **Hits have no channel of their own.** Each egg's state carries its last
  eight hits (`g`, `[id, target, damage, head, weapon]`, ids from
  `Date.now()` so a reloaded tab keeps climbing) and each frame applies the
  ones naming it that it had not seen. The first state seen from a player
  only sets the watermark, so joining mid-game never replays old hits. That
  is what let the whole game ride on `vivo` without a rules change there.
- **The frame is configured once the room has started**, with the seats in
  order (the seat decides the shell colour, `PALETA` in `juegos/yemas/js/red.js`),
  and gets the reducer's scoreboard on every repaint plus each `muere` once,
  by key, for the kill feed; the first batch is flagged `viejas` and not
  announced.

**Four variants over one reducer** (`variante` in the room, not `modo`,
which the rules whitelist): `todos` (free-for-all), `equipos` (team
deathmatch), `bandera` (capture the flag) and `zombis` (co-op waves, below). Teams are by seat parity
(`equiposYemas`), so a room splits itself evenly as it fills. The room picks a
`largo` (short/normal/long) rather than a number, because one select cannot
change its options by another; `YM_LARGOS` turns it into 10/15/25 kills,
20/30/50 team kills or 1/3/5 captures, and a room from before, with only a
`meta`, still reads it. In capture the flag **the flags are game state, so
they go in the log**, written by whoever touches them: `{t:"toma", b}`,
`{t:"devuelve", b, auto?}`, `{t:"captura", b}`, plus the carrier's `muere`
with `x`/`z` to drop it where they fell. The log's order settles two players
grabbing at once. A capture needs your own flag at home, and a dropped flag
goes home when a teammate touches it or, after 25 s, when any teammate's
frame sends `auto`. Bases are `YM_BASES` in `motor.js` and `BASES` in the
frame's `mundo.js`, which must agree. There is no friendly fire (the frame
skips teammates in the raycast), and each team spawns in its own half.

**Zombies (`zombis`) are moved by one player's frame, the director**
(`juegos/yemas/js/zombis.js`, wired in `main.js`). There is no server to
run them, so the first seat still in the room whose egg is visible in `vivo`
simulates them (`director()`). If that tab closes, its `vivo` entry goes
with `onDisconnect` and the next seat takes over from the last `zb` it saw
(`adopta`). Two frames may both direct for a moment while that settles; the
cost is a stray bite, not a broken game. Seven things hold it together:

- **The zombies ride the director's own state**, as `zb: {r, q, j, p, e, z, m}`:
  round, how many are still to spawn (`j`: bosses still to spawn), the start
  and between-round timers, each zombie as `[id, x, y, z, ry, hp%, rising,
  burning, phase, window, kind, marks]` (marks: 1 helmet on, 2 charging, 4
  screaming), and the last 20 deaths as `[id, killer, head, weapon, explodes,
  kind]`, where `explodes` is 0, 1 fire, 2 toxic gas or 3 a dog's burst.
  Fields only ever go on the end, so an older frame still reads the state
  (an unknown kind draws as a common one). The other frames only draw them
  (`desdeRed`). Firebase drops empty arrays, so `zb.z` can come back
  missing, and `lista()` reads that as no zombies.
- **Shots at a zombie are ordinary hits** addressed to `z:<id>` in the
  shooter's `g` list. `red.js` hands those to `alGolpeZombi`, and only the
  director applies them. Bites go the other way: the director sends a hit
  with weapon 9 (`ZOMBI`). The victim's frame turns it into a death with
  `por: ""`, so it is nobody's kill.
- **Points live in each frame** (`yo.pz` to spend, `yo.pzT` earned). A hit
  pays 10 and a kill 60, or 100 to the head, or 130 with the pan. A kill
  only pays when a death in `zb.m` names that player. Each `vivo` state
  carries `pz`/`zk` for the Tab table.
- **What is bought is the map's** (see below): wall weapons, the box,
  perks and Pack-a-Punch. `E` buys with points, and buying an owned wall gun
  refills it at half price. None of that goes through the log.
- **Rounds and falls are game state.** When a round is clear the director
  waits `ZB.pausa` and writes `{t:"ronda", r}`. `redYemas` accepts only the
  next round, and accepting it revives everyone who fell. In zombies a
  `muere` marks the player fallen and carries `pts`, `zk` and `r`, all
  integers that only go up. The game ends the moment every player still in
  the room is fallen. The top `pts` wins, and `""` (a draw) if nobody
  scored. Being left alone is not a win by abandono.
- **Before falling there is a last stand** (`cae`, `pasoAbatido`,
  `ABATIDO` in the frame's `main.js`). Reaching 0 hp in zombies does not
  write `muere`: the egg goes down (`yo.abatido`, still `vivo`, so it is
  not in `caidos`) with the pistol — its own, or a borrowed one taken back
  on getting up — crawling at a quarter of the speed, with no perks.
  Zombies ignore it (`pasoZombis` passes `vivo: false`). The state carries
  `ab` (seconds left), which tilts the egg in the other frames. A teammate
  within 1.6 m holds E for 4 s (`pasoRevivir`) and sends a zero-damage hit
  with `a: REVIVE` (99) that lifts it; only when the 30 s run out does it
  `morir`. With nobody else standing the clock drops to 2 s, so a downed
  team still loses. **Quick Revive halves the time it takes you to lift
  others**, and **alone** it lifts you after 3 s, once (it is lost like
  every perk). Alone without it you die at once.
- **A fallen player waits for the round.** The frame only respawns when
  `marcador.ronda` grows, with the pan and the pistol and keeping the
  points. Those still standing get their grenades back. Health regenerates
  after 4 s without damage, in zombies only. A reloaded tab whose player is
  in `caidos` stays fallen.
- **Zombies walk the map's graph.** They spawn outside a window (or rise
  from the ground on the open maps), tear its boards off one at a time,
  climb in, and then go by `nodos`/`enlaces`. A link through a door only
  counts once that door is open, so the distances are recomputed
  (Floyd-Warshall, under fifty nodes) every time one opens. A zombie that
  sees its prey chases it straight.
- **Every round is harder, slowly.** The curve is Black Ops' stretched
  out, so the pressure arrives around rounds 10–15 rather than by round 5
  (players complained it climbed too fast). `hpRonda` is 60 + 35 per round
  up to round 9 and then ×1.09; `velRonda` goes from 2 m/s by 0.25 per
  round up to 5.5, so common zombies never catch a walking player (7 m/s).
  **At most 24 stand at once** (`MAX_ZOMBIS`, as in Call of Duty), however
  many players and whatever the round; below that, `maxVivos(n, r)` = 5 +
  2·players + one per two rounds, and the rest wait their turn. The bite
  (`mordidaRonda`) is 30 in round 1 (four to fall), reaches 50 at round 9
  and tops out at 75. No bite takes more than 95, so a full-health player
  is never killed in one go. A kill pays `CLASE[t].puntos`, plus 40 for
  the head or 70 for the pan.
- **Something new arrives every few rounds until past round 30**, as in
  Black Ops: nine kinds (`TIPOS`, `CLASE`, `FORMA`), mixed in by
  `tipoRonda` from `MEZCLA` (rare kinds first, each growing per round up
  to a cap) and limited by `TOPE_VIVOS` so ten napalms are never a wall of
  fire. The runner (`c`, round 5, `velCorredor`, catches a walking player
  from 13). The big one (`g`, 8: slow, three times the life). The toxic
  one (`t`, 10: crawls, and bursts into gas that hurts whoever is within
  `ZB.gas`). Napalm (`f`, 15: always burning, scorches whoever stands
  close every second, immune to lava, explodes on death). The shrieker
  (`x`, 18: its scream is a zero-damage hit with `a: GRITO` (98) that
  blinds for 1.3 s). The helmeted one (`k`, 22: headshots do 15 % and
  count as body shots until the helmet, 60 % of its life, breaks). From
  round 28 the specials weigh half again and commons nearly vanish.
  **Two kinds of round break the routine**: dog rounds (`esPerros`: 6,
  11, 16…) spawn only hellhounds (`p`), out of a lightning strike a few
  metres from a player under orange fog, and the last one drops a Max
  Ammo; boss rounds (`esJefe`: 20, 25, 30…) open with the Mutante (`j`,
  two from round 30 with two or more players), whose life is `jefeHp`,
  that no single hit can take more than 8 % of (so no Insta-Kill
  one-shot, and Kaboom skips it), that charges at ×3.2 when hurt
  (`carga`, `cdCarga`), shakes the screen, shows a bar (`#jefe`, painted
  by `pintaJefe`) and always drops a power-up. A round is only clear when
  `q`, `qj` and the field are all empty. `novedadRonda(r)` announces each
  of these, and the test checks there is never a gap of more than three
  rounds from 5 to 30.
- **A zombie's shape is what gets shot.** `FORMA` (scale `e`, relative
  height `a`) and `MEDIDA_Z` in `mundo.js` must agree (the test compares
  them): `rayoHuevo(o, d, p, escala, alto)` flattens the ellipsoid of a
  dog or a crawling toxic, the head line is `alto`-scaled in both
  `primerBlanco` and the hit, and `chocaZombis` scales radius and height
  too. The models (`crearZombi` in `mundo.js`) carry what `animar` moves:
  `patas` (a dog's gallop), `repta`, `yelmo`, `boca`, `ojos`.
  `tests/yemas-zombis.test.cjs` pins the curve, the cap, the round each
  kind arrives in and the special rounds.

Practice can be zombies too: the menu's mode select gives `conectarLocal`
`variante: 'zombis'`, `RedLocal` keeps the round and ends the run on the
first death, and a button reloads it.

**The zombies maps are Black Ops' five, as data** (`juegos/yemas/js/mapas.js`:
`nacht`, `kino`, `nuketown`, `riese`, `pueblo`). A map is plain boxes,
decoration, windows, a navigation graph, doors with prices and the zones
they open, and where the perks, the box, the wall weapons, Pack-a-Punch, the
power switch and the lava go. It has no THREE and no DOM, so Node can walk
it. `mundo.js` draws it, `zombis.js` navigates it and
`juegos/yemas/js/interactivo.js` owns everything that is bought or touched.
Things to know:

- **The map is chosen with the room** (`partida.mapa`, an option of the
  yemas card). `mapaYemas` in `motor.js` clamps it to `YM_MAPAS`, the
  config carries it into the frame, and `red.mapa` reads it. Practice uses
  `#mapa-practica`. The rules do not validate `mapa`, so this needed no
  rules change.
- **What belongs to the room rides the director's `zb` too**, under keys
  that do not clash with `zombis.js`'s: `o` open doors, `l` power, `k`
  boards per window, `n` where the box is, `t`/`f`/`w` the teleporter.
  Points, perks and weapons belong to each player and are paid and given
  in their own frame.
- **A non-director asks with a zero-damage hit to `p:<what>`.** `red.js`
  hands it to `alPeticion`, which calls `inter.peticion`. The asking frame
  applies a door or the power at once: those only go one way, so the
  director has nothing to contradict. Boards go both ways, and there the
  director's state wins.
- **Perks need the power** except Quick Revive (500 alone, as in BO1). They
  and Pack-a-Punch are lost on falling. Pack-a-Punch is `conPap` in
  `armas.js` (double damage, a clip and a half). The box can give the Rayo
  batido (`10`), the Amasadora (`11`) and the Huevera (`12`), which exist
  only in zombies, and pulling the teddy bear moves it.
- **Each dead zombie leaves a green fried egg** on the floor (`friteVerde`
  in `zombis.js`: green white and rim, an orange yolk that pulses) for
  `HUEVO_VIDA` seconds, fading over the last three, drawn in every frame
  from `zb.m`. In Pueblo, a zombie that steps in the `lava`
  burns (`quema`) and explodes when it dies, hurting players near it.
- **Power-ups** (`juegos/yemas/js/bonos.js`, `BONOS` in `armas.js`): a
  dead zombie may drop Insta-Kill, Carpintero, Kaboom, Munición máxima or
  the Máquina de muerte (weapon 13, a heavy minigun for 30 s, only for
  whoever took it). They ride `zb` as `b` (on the floor) and `x` (the last
  eight taken); a non-director asks with `p:bono:<id>` and hides it at
  once, and every frame applies each `x` entry once.
- **Zombies collide with players** (`chocaZombis` in `main.js`). The push
  from every zombie is summed, capped at `EMPUJE_MAX` per frame, and applied
  through `empujaCuerpo` in `mundo.js`, which collides with walls like
  walking does. It used to be added to the position directly: a horde
  against a wall pushed you *inside* it, and `moverCuerpo` resolved the
  overlap by lifting you onto the top of the box, i.e. standing on a 4 m
  wall, out of the map. `moverCuerpo` now only rests a body on top if it
  came from above (or a step up), and pushes anything else out sideways
  (`sacaDeCaja`). Zombies
  **climb** rather than jump; a player standing on something makes them
  replan towards the nearest climbable edge instead of piling up below.
- **Every map is checked by walking it** (`tests/yemas-mapas.test.cjs`):
  each link of the graph is walked like a body would walk it (0.3 m wide,
  steps up to 0.6 m, falls when the floor ends, the link's own door open)
  in both directions, and must reach the other node's height; every node,
  spawn and ground spawn must be clear; the graph must be connected; and
  every window must land near a node. It found tables, a fence, a
  mannequin and the Der Riese generator standing on links, where zombies
  used to pile up. A prop that only decorates goes in `decor` (no
  collision); a `caja` must not touch a link.
- **The maps carry the originals' landmarks**: Nacht's barbed-wire ring,
  searchlight and craters; Kino's marquee with its bulbs, an open-air
  alley with a fire escape, the lobby's rope posts, the mannequins on the
  stage and the film reels; Nuketown's burnt, smoking bus, porches,
  mailboxes, the garage hoop, a swing and a picnic table per yard and the
  countdown clock; Der Riese's catwalk across the courtyard, the
  hellhound cages in the lab, the cables from the mainframe, the Gruppe
  935 eagle, the chimneys, the crane and the wagons; Pueblo's parked
  TranZit bus with its stop, the water tower, telephone poles and the
  round vault door (which goes with the `boveda` door). A `cil` decor
  takes `o.rx` to lie down.
- An unbought wall weapon shows only its **silhouette**; Pack-a-Punched
  weapons get a metallic material; drinking a perk plays an animation and
  each perk has an icon on its machine and in the HUD. **Double Tap fires
  two bullets**, not double damage.

**Zombies rooms are ranked apart, by map and by round.** `anotar` in
`juegos-main.js` does not write `ranks/yemas` for a `zombis` room: it calls
`fb.guardarSolo("yemas-zombis-<mapa>", …)` with `puntos` = the round
reached and `tiempo` = the game's length, so the table orders by round and
then by time. `ranks.js` shows it as **Yemas zombis** (`EXTRA.yzombis`, in
the «En sala» group) with a «Mapa» row. The `soloRanks` regex was widened,
so the rules must be re-published.

**A team win is `ganador: "eq:rojo"`**, and `ganoEn(p, ganador, uid)` in
`motor.js` is the one place that knows it includes the whole team. `anotar`,
`pintaFin` and logros' `contexto` ask it instead of comparing with the uid,
so the ranking gives the win to every member. `nombreDe` says «el equipo
Rojo».

**Voice chat is WebRTC between browsers** (`juegos/voz.js`, generic, used by
`yemas.js`). It is a mesh with no media server, and the database is only
the signalling mailbox, `vivo/<pid>/voz` (`fb.senalVoz`): `en/<uid>` holds
each person's session while they are in, and `b/<uid>/<push>` holds the
offers, answers and ICE candidates sent to them, deleted on read. Both are
removed on disconnect. Three rules keep it simple. The lower uid of each
pair offers, so there is no glare. Every message carries the sender's and
the recipient's session, so leftovers from a reloaded tab are ignored. ICE
candidates that arrive before the offer wait in a queue. The mic is
push-to-talk on V by default, or open; the frame forwards the V key
(`hablar`) and paints who is talking (`voces`, measured with an
`AnalyserNode` in the room page). Only STUN is configured, with no TURN, so
two networks that refuse a direct connection (some mobile carriers) do not
hear each other; the bar strikes that name through in red rather than
staying silent. Because it all lives in `vivo`, **no rules change was
needed**. `voz.js` takes the mailbox as a parameter, so it was tested with
three instances in one page over real `RTCPeerConnection`s, a fake mailbox
and oscillators as microphones.

**The voice outlives the game, not the room.** At `fin` the postman deletes
only the eggs (`fb.borraYemasVivo`, `vivo/<pid>/y`) and keeps the voice.
`vivo/$pid/voz` has its own rule that lets players write after `fin` (a
child grant, OR'ed with the parent's), so a reconnection still signals.
Leaving the room (`destruir`) is what hangs up. Whoever was in the voice
has the room's pid in `sessionStorage` (`yemas.voz`), and the postman
re-enters by itself in a reload of the same room or in the rematch
(`p.origen`). A re-entry without a gesture can leave remote audio
blocked, so `voz.js` retries `play()` on every level check and it sounds
from the first click anywhere, the game frame included. The rules must be
re-published for the after-`fin` part; until then, established
connections keep talking and only new signalling fails.

**In the team variants each player picks a team** while the room waits:
`{t:"equipo", uid, e}` from the picker the postman draws above the frame.
`equiposYemas` starts from seat parity, applies the last choice of each
player **before the first game event** (a death or a flag touch), so teams
cannot change mid-game, and falls back to parity if a team ends up empty
with two or more in the room. The frame gets the teams on every
`marcador` and repaints the eggs when a colour changes.

**Grenades** (`juegos/yemas/js/granada.js`, the *Huevo duro*, weapon index
3, `YM_ARMAS`): two per life, `G` or `4`. The thrower's frame simulates it,
decides where it bursts and whom it reaches (line of sight from the burst,
damage falling linearly over `radio`), and sends the damage through the
usual hits with `a: 3`. Self damage is half and applied directly, so a
self-kill is a `muere` with `por` = oneself, which counts as a death and no
kill. The state carries the last throw (`n: {i, o, v}`) and the last burst
(`x2: {i, p}`). The others simulate the throw only to see it fly, and they
burst it **where the owner said**, because two simulations with different
frame rates do not land on exactly the same spot.

**Self-destruct** (weapon index 4, `AUTO` in the frame's `main.js`): hold X
for `AUTO.carga` (0.9 s); releasing earlier or losing focus cancels it, so it
never fires by accident. While charging the state carries `ad: 1` and the
other frames make that egg glow red and beep, which gives them a moment to
run. It bursts like a grenade (same `alcanceExplosion`/`golpeaRivales`,
published as `x2`) with its own radius and damage, and the player always dies
with `por` = themselves.

**Explosions are measured at three points of each egg** (feet, middle,
head; `alcanceExplosion`), and the best one with a clear line counts. Damage
is full within `pleno` and falls linearly to `radio`. The rocket used to
burst *inside* the box it hit, so the wall it touched blocked the line to
every egg, and a rocket hitting the wall beside someone did nothing. That is
why `granada.js` now backs the burst point out along the flight before
bursting.

**The arsenal** (weapon ids in the frame's `armas.js`, never renumbered
because the log names them: 0–2 the original three, 3 the grenade, 4 the
self-destruct, 5 the pan (it was a knife, same id), 6 the bazooka, 7 the
pistol, 8 the golden spatula, 9 a zombie's bite, 10–12 the box's wonder weapons, 13 the
Máquina de muerte; `YM_ARMAS` = 14).
Everyone starts with the pan (`SARTEN`) and carries at most two more. The rest lie on
`PUNTOS_ARMA` (frame's `mundo.js`, `YM_PUNTOS_ARMA` in `motor.js`, which must
agree). **Which** weapon lies on point `s` at its appearance `g` comes from
the room's seed (`armaEnPunto`, so every screen sees the same one, and the
postman sends `semilla` in the config). **Who takes it** is game state:
`{t:"recoge", uid, s, g}` counts only if `g` is the next appearance after the
last one taken there, so two players grabbing at once are settled by the log.
`est.armas` is `{s: {g, uid}}`, and the frame grants the weapon when it sees
itself as the taker. Each screen brings the next appearance back
`REAPARECE` (18 s) after seeing one taken; that timing is the screen's alone.
Walking over a free slot or a weapon already owned picks it up (an owned one
only refills it), and with both slots full `E` swaps the one in hand.
Inventory and ammo live in the frame: every gun has its magazine plus
`RECARGAS` (8) reloads per life (`RECARGAS_ZOMBIS`, 14, in zombies), and weapons survive death. Respawn after
being killed refills life, ammo and grenades. After a **suicide that killed
nobody**, it restores the life, ammo and grenades held just before. A kill
that arrives while dead, or within 300 ms before dying (practice resolves it
synchronously), counts as having killed someone. The bazooka's rocket rides
`granada.js` as kind `cohete`. It flies straight, and the owner's frame
bursts it on a wall, on the floor or **near** an egg: `tocaHuevo` inflates
the egg's ellipsoid by `espoleta` (1.4 m). Within `pleno` (2.2 m) it does a
full 150, so hitting the egg itself is not needed.

**The golden spatula** (id 8, `ESPATULA_CFG` in `armas.js`) only appears in
`todos`. `armaEnPunto(..., espatula)` makes one appearance in `rara` (16)
the spatula, from a different slice of the same hash, so every other
appearance stays the weapon it was. It is taken with the usual `recoge` but
occupies no slot (`yo.espatula`), and it is lost on death. `Q` throws it at
the living rival closest to the crosshair. The thrower's frame flies it
through walls at 17 m/s. Every 0.55 s at touching distance it sends a hit
with `a: 8`, and the **victim** takes half of whatever life it has left
(`ceil(hp/2)`, so 100 dies on the seventh). It stops when the target dies,
leaves or 20 s pass. The state carries `ep: {i, u, p}`, so the others see it
fly and the target gets a warning.

**Grenades are a loadout**: two per life, each `duro`, `humo` or `luz`
(`GRANADAS`), chosen in the pause card or with Z/C while dead, kept in
`localStorage` (`yemas.pref`, with the mouse sensitivity and the skin). `T`
picks which one `G` throws. Launches and bursts carry their kind (`n.k`,
`x2.k`). Smoke is local sprites plus a grey overlay while the camera is
inside the cloud; bullets go through it. The flash blinds each viewer by
distance, line of sight and whether they were facing it, the thrower and
teammates included.

**Skins** (`SKINS` and `ponSkin` in the frame's `mundo.js`) are accessories
hung off the egg's body; the shell keeps its seat or team colour. The state
carries `sk`, and a remote egg whose skin changes is rebuilt.

**Sprint and slide are the frame's alone** (`SPRINT`, `DESLIZ` and
`deslizar()` in its `main.js`). Shift while moving forward runs ×1.6 with a
wider FOV and a little more spread; C while running on the ground slides
along the current velocity with friction until it is back to walking pace,
lowering the camera. A slide ends the sprint, and `sinSprint` keeps it ended
until Shift is released, so holding Shift does not chain slides. Jumping
out of a slide jumps 1.3 times higher (and ends the slide, keeping the
momentum). C still cycles the second grenade while dead. The state carries `ds: 1` while
sliding, and the other frames tilt that egg back and play the scrape. Hit
detection still uses the upright egg.

**A death leaves a fried egg** (`huevoFrito` in the frame's `main.js`): an
irregular white `ShapeGeometry` over a golden crispy rim and a glossy
half-dome yolk off-centre, grown in over a third of a second, with a sizzle
(`sonido.fritura`), faded after 14 s, at most 30 on the floor.

**Fullscreen is the frame's**, not the page's. The room header's ⛶ asks the
module first (`modulo.pantallaCompleta()`, which `yemas.js` answers with
`frame.requestFullscreen()`), and only a game without that hook falls back
to the immersive mode. Inside the frame, `F` and a button on the pause card
do the same with the frame's own document (Shift+F, not F alone, which sat
next to G and fired by accident). The voice bar stays outside;
`V` still reaches it, and the pause card has a **🎙 Entrar a la voz**
button that asks the postman (`voz`).

Opened on its own, `juegos/yemas/index.html` is practice against four bots
with the same engine (`conectarLocal`), which is also the quickest place to
test a change. The window hooks `__yemas.paso(dt)` step the game without
`requestAnimationFrame`, which is how it can be driven from a script while
the tab is hidden. `tests/yemas.test.cjs` covers the reducer, the four
variants and `ganoEn`. Practice is free-for-all or zombies. The team modes
and online zombies were tested with several frames driven by a fake room
that runs the real `reducir`.
