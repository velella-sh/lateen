# Source mode

A switch that shows `file:line` beside every top-level block, so a reader or an agent sees where each block came from.

- `index.ts` renders the switch (hidden until `client.ts` runs) and its status region. `layouts/base.ts` places it once at the start of the main content.
- `client.ts` stamps a `file:line` label as the last child of each top-level `[data-src]` block (so it follows the block's text in reading order), starts off on every page view (the choice is never restored), toggles when the reader activates the button, and announces each change in the page language. The command palette's "Source mode" action presses the same button.
- `state.ts` holds the root class (`source-mode`).
- The theme hides labels until the root carries `.source-mode`, then displays them below their block in reading order.
- The span is read by `src/source-span.ts`.

- Each label is a copy button for `file:line`; with a GitHub or GitLab `repository` it also links the same line there (`src/repository.ts`, opens a new window and says so in its accessible name). No repository, or another forge, means no link.
- `editor.ts`: `theme.options.sourceMode.editor` is a URL template with `{path}`, `{line}`, `{column}`. Only the schemes in `EDITOR_SCHEMES` are accepted (editor handlers such as `vscode`, `cursor`, `zed`, `idea`, `subl`); `http(s)`, `javascript`, `data` and `file` are rejected. The reader sets the checkout folder once with the "Set editor folder" button (local storage, `lateen-source-folder`); editor links appear only after that.
- `?source=<file>:<line>` turns the mode on, scrolls to and focuses the label of the block holding the line, falling back to the nearest block before it. A file that is not this page's source, or a line above every block, is announced in the status region.

Known gap: lists and tables (`ul`, `ol`, `dl`, `table`) get no label yet, because a child label would break their content model.
