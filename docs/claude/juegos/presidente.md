# Presidente — notes for Claude

Screen: `colabtex/src/juegos/presidente.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

**Presidente (`presidente`) is a table that never ends.** Each trick is one
lap: every active player acts once, then the highest play opens again (or
the next active seat if that player finished/left). Normal ranks are 2–A;
exactly two jokers (IDs 52–53) accompany either 52 or 104 normal cards.
The second normal deck occupies IDs 54–105. One joker covers singles/pairs;
both cover triples. A joker may beat another joker, and the trick retains
its original group size. `jugadaPr` shares validation with the UI.
A round is dealt,
played out and scored (`n − 1 − position` points), and the next one starts by
itself with the roles of the last: the Culo gives their two best cards to the
Presidente and gets two back, the Viceculo one to the Vice. Between rounds
anyone may sit down (`entra`) or stand up (`sale`, which mid-round means
«after this one»); the game ends only when half the table votes `cierra`,
and the most points wins. With no dealer the deal is **mental poker**: each
seat, in order, shuffles the deck under its own commutative lock (`mezcla`),
then each removes its lock from everyone's hand but its own (`quita`), so
nobody knows another hand. Exchange cards travel in DH-sealed envelopes
(`sobrePr`). Every round's key comes from a hash chain committed as `hcad`
(`cadenaPr`, 1000 rounds) and is revealed when the round ends (`llave`);
`auditaPresidente` then replays every shuffle, lock removal, envelope and
card played. The screen (`presidente.js`) sends by itself what only it can
send — keys, its shuffle and lock turns, the forced «best cards», and «paso»
when nothing beats the table — and offers **Saltarle** for someone asleep.
`tests/presidente.test.cjs` plays robot tables with people joining, leaving
and voting, and checks the audit catches a crooked shuffle, a short exchange
and a card that was never in the hand.
