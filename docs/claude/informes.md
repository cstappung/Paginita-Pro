# Informes — notes for Claude

`informes.html` + `informes-app.js`, entry `colabtex/src/reports-main.js`.

Errors the apps collect on their own, plus the bugs and ideas people write, in
one place that everyone with a session can read and that exports to a file.

- `reports.js` — the **pure** part: filtering, trimming, fingerprinting, the
  local buffer and the Markdown export. No DOM beyond the download, no
  Firebase — verifiable in Node.
- `fb-reports.js` — the two new RTDB nodes, `errors/<fingerprint>` and
  `feedback/<id>`, deliberately **outside** `projects/`: a report belongs to the
  team, not to a document.
- `report-widget.js` — the ⚑ button and its modal, injected (CSS included) into
  every page, so adding it to a fourth page is one import.
- `reports-main.js` + `informes.html` — the page itself.

Four decisions worth keeping:

- **The death rattle is judged per compilation, not per line.**
  `! Emergency stop.` and `! ==> Fatal error occurred, no output PDF file
  produced!` always come out together and always *behind* something else, so on
  their own they name no cause. In the tracker they were two entries of 8
  repetitions each — 16 rows saying nothing — because the real cause of that
  compile was a typo in the document and had been dropped, correctly. So
  `fallosDeLaTeX` decides over the whole compile: a cause of ours wins and the
  rattle is redundant; no cause but a user typo means the rattle is theirs and
  nothing goes up; neither one means the rattle is the only evidence there is
  and it does go up.
- **Half the value is in what gets thrown away.** A mistyped `\aling{}` is not
  an app bug, and if those got in, the report would be an endless list of other
  people's typos with the real faults buried in it. So from the LaTeX log only
  *our* failures go up (a missing package or font, the engine aborting, memory
  exhausted — `TEX_DE_LA_APP`), user typos are dropped explicitly
  (`TEX_DEL_USUARIO`), and **anything unrecognised is dropped too**. A compile
  that throws outright is the exception: that is always ours. The price of that
  last rule is that a fault nobody wrote a pattern for is invisible, and it was
  paid in full: `!pdfTeX error: /bin/busytex (file umvs): Font umvs at 600 not
  found` matched none of the eight app patterns — the first one wants
  `file … not found` with nothing but non-space in between, and here there are
  twenty characters of `): Font umvs at 600 ` in the way — so a real packaging
  bug of ours never once reached the tracker. `/font .* at \d+ not found/` is
  now in `TEX_DE_LA_APP` and it is always ours: the font is packaged, what is
  missing is its line in the map. From the browser, known noise goes
  (`Script error.` with no origin, the ResizeObserver loop,
  extensions, user-cancelled dialogs, network blips) — but a
  `PERMISSION_DENIED` stays, because that is exactly how the ColabDraw link bug
  would have surfaced.
- **Nothing of anyone's document is stored.** Message trimmed to 300 chars,
  three stack frames with the file name only, browser and OS by *family* (never
  the full user-agent string), and a `ctx` whose values are capped and whose
  object-valued entries are dropped — that last one is what stops a whole
  document being smuggled in as "context". The `where` (what the app was doing)
  is worth more for reproducing than the minified stack.
- **A quoted file name survives the fingerprint** (`normaliza`): quotes and
  digits are blanked so the same fault groups, but that turned every
  `File `x.sty' not found` into one row. File names are now kept as-is.
- **Errors are keyed by fingerprint, not pushed.** The same fault seen a hundred
  times is one row with a counter; otherwise the noisiest error hides the other
  nine. The counter is bumped with `runTransaction` because several people write
  it at once, and `quien/<uid>` is a map rather than a number so "how many
  people" can actually be counted.
- **It degrades instead of breaking.** `errors` and `feedback` are new nodes, so
  until the rules are re-published by hand in the console everything fails with
  `PERMISSION_DENIED`. The page then shows a plain-language warning naming that
  exact cause, the ⚑ modal offers to download what you wrote so it isn't lost,
  and errors keep piling up in `localStorage` regardless.
