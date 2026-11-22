# Clipboard result path

The one clipboard write→result→restore sequence the clipboard chrome shares. `code-copy`,
`copy-markdown`, and `ask-agent` keep their own localized words and their own
place to show them; this folder owns only the order of events: a failed write is never reported
as a success, a slower earlier write never overwrites a newer result, and a pending restore can
be cancelled. This folder has no component and no island of its own.

- `result.ts`: `writeClipboard` (never rejects; a boolean says whether it worked) and
  `createResultFlash` (show the result, restore after the reset time, per-target latest wins in a
  `WeakMap`).
