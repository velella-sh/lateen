# Copy page as Markdown

A button that copies the page's Markdown twin, for pasting into an agent or an editor. The same
twin is offered as a plain link, so the page still gives a reader the Markdown when JavaScript is
off or the browser has no clipboard.

## Files

- `index.ts`: the Preact component. Its default export is the chrome part. It renders nothing for a
  page that is not a doc page (`page.kind !== "doc"`) or whose URL has no Markdown twin. The twin
  both the link and the button use is resolved against the site's base exactly once (`pageUrl`
  adds `base` only when the page URL does not already carry it, the same rule the command palette
  uses), so a subpath deployment never offers a root-relative twin and a base is never doubled.
- `style.css`: the button, the link, and the status region, from design tokens only.
- `island.ts`: the page copy island, shared with `chrome/page-agent-menu`. It fetches the twin on
  activation, writes it to the clipboard, and announces the result on the status region.
- `client.ts`: the copy-Markdown entry point: it reveals the button when `navigator.clipboard` and
  `fetch` both exist, wires the island, and re-exports the island for tests.
- `../../test/chrome-copy-markdown.test.ts`: the unit's tests.

## Strings

The labels come from the theme's string table: `copy_page_md`, `copied`, `copy_failed`,
and `view_markdown` (English, Persian, and Arabic).
