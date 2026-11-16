# Source mode

A switch that shows `file:line` beside every top-level block, so a reader or an agent sees where each block came from.

- `index.ts` renders the switch (hidden until `client.ts` runs) and its status region. `layouts/base.ts` places it once per page, above the shortcuts launcher.
- `client.ts` stamps a `file:line` label as the last child of each top-level `[data-src]` block (so it follows the block's text in reading order), applies the saved choice, toggles on click or the `y` key (the single-key preference in `chrome/shortcuts/` applies), and announces each change in the page language. The command palette's "Source mode" action presses the same button.
- `state.ts` holds the storage key (`lateen-source-mode`, `on` or `off`) and the root class (`source-mode`).
- `style.css` hides labels until the root carries `.source-mode`, then draws them absolutely: in the start margin on wide screens, above the block on narrow ones. Nothing moves when the mode turns on.
- The span is read by `src/source-span.ts`, shared with `chrome/block-actions/`.

Known gap: lists and tables (`ul`, `ol`, `dl`, `table`) get no label yet, because a child label would break their content model.
