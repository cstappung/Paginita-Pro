# Deployment, Firebase and security model

Read before touching `firebase/database.rules.json`, `storage.rules`, or adding any RTDB node.

- The site deploys to **GitHub Pages** from `main` at repo root. The repo is
  ~220 MB because of `vendor/busytex/` (largest file ~99.7 MiB, just under
  GitHub's 100 MiB limit); Pages on a free account needs the repo public.
- **Firebase security rules and Storage CORS are NOT deployed by pushing to
  Pages** — they must be published in the Firebase/GCloud console manually. Full
  one-time setup (RTDB rules, Storage rules, CORS, authorized login domains) is
  in [firebase/CONFIGURAR-FIREBASE.md](firebase/CONFIGURAR-FIREBASE.md). After
  editing `firebase/database.rules.json` or `storage.rules`, re-publish them
  there.

## Security model (what the rules can and cannot hold)

The Firebase config is public by design; everything rests on the rules, so
each new node must be written assuming a stranger with a console. What the
October 2026 pass settled, and must not regress:

- **A share token can only carry `edit` or `view`** (`tokenIndex/$token`
  `.validate`). The member rule accepts any role a token names, so without
  that an editor could mint an `owner` token and join with it.
- **`users/<uid>` is owner-only; only `users/<uid>/perfil` is public**, and
  every field there is validated (`$otro: false`). Uids are visible in every
  game room, so a world-readable `users/` leaked everyone's email. The email
  is no longer written (`ensureUserRecord` sends `email: null`), and no name
  falls back to `user.email`.
- **Colour and photo are sanitised on read** (`juegos/sano.js`, applied in
  `fb-juegos.js` to rooms, lobby, ranks and profiles) because a hundred places
  interpolate them into HTML strings unescaped: `style="--c:${color}"`. The
  rules allow only `#rrggbb` and clean `https://` (plus a JPEG/PNG/WebP
  data URL in a profile), but rules lag behind publishing and old data stays.
  Read-side cleaning is what covers both. A new field that is painted into
  markup belongs in `sanea`.
- **Privileges live in `admins/<uid>`**, readable by its owner and writable
  by nobody from the web (set by hand in the console). Admins delete errors
  and change other people's feedback state (`esAdmin` in `fb-reports.js`;
  Informes hides ✕/✓ for everyone else).
- **`discord/` stays readable by anyone signed in, on purpose.** The owner
  wants every room announced without keeping a list of people, and accepted
  the risk: anyone with a session can copy the webhook and spam the channel.
  The remedy is swapping `discord/webhook` in the console. A `confianza/<uid>`
  allowlist was tried and dropped for that reason.
- **Storage cannot see the database**, so it cannot check membership. Each
  object carries `customMetadata.uid` (`sube` in `fb-api.js`) and only its
  uploader may replace or delete it; HTML/JS content types are refused.
  Overwriting someone else's file falls back to the base64 copy in RTDB
  (≤ 3 MB). Older objects without the mark stay open. Uploading over an
  existing object is evaluated as `create`, not `update` (`update` is a
  metadata-only change; verified in the emulator), so the owner check has to
  live in `create` too.
- **App Check is wired but off** (`APP_CHECK_SITE_KEY` in `firebase.js`).
- Inherent limits, stated in `CONFIGURAR-FIREBASE.md` section 0: a player can
  write `fin` for a game they are in, chat and feedback can be spammed, and
  `clueElenco` and `discord/` are readable by anyone signed in.

`tests/seguridad.test.cjs` checks the sanitiser and pins those rule shapes.
