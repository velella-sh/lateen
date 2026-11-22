# Agent action contracts

Lateen's page actions are progressive enhancements: every piece of documentation is in the
server-rendered HTML and every action is hidden until the island that can perform it is running. A
reader without JavaScript keeps the prose, the code, the recorded output, the Markdown link, and the
provider links; a reader with JavaScript gets the same content plus copy and navigation commands.

## Page actions

| Action | Markup | What it copies or opens | Without JavaScript |
| --- | --- | --- | --- |
| Copy page as Markdown | `.copy-markdown-button`, `data-markdown` | The page's Markdown twin, byte for byte | The visible `View Markdown` link to the same twin |
| Use with an agent | `.page-agent-menu`, `theme.options.pageAgent.providers` | A provider URL built from the page's twin, URL, title, language, source, and declared version | The provider links and the Markdown link |
| Edit with your agent | `.page-footer-copy`, `data-prompt` | A localized prompt naming the page source, its language and declared version, and its title | No button; the source context is in the page |

The Markdown twin follows the page URL, so a versioned or prefixed route (`/v2/guide/install/`,
`/fa/guide/install/`) keeps its language and version without the action having to rebuild the URL.
`data-markdown` is the same address the link uses, and the command palette, page copy control, and
provider menu share the twin rule.

Code, output, terminal, endpoint, and schema blocks also publish their canonical values as inert
JSON or data attributes: `data-placeholders`, `data-output-deps`, `data-output-evidence`,
`data-terminal-commands`, `data-endpoint-operation`, and `data-schema-fields`. An agent can read
those values without scraping styled HTML.

## Grouped examples

A variables form, its terminal, and its output block carry one explicit `group` (letters, digits, `_`,
and `-`). The group is rendered as `data-variable-group`, and an authored group also carries
`data-variable-group-explicit="true"`; a form without one derives the group from its sanitized `id`, so a
single-form page needs no group. Matching is exact: two forms with the same variable name keep
independent values, and a change in one group never rewrites another group's terminal or output.

On a page with exactly one form and no authored group, ungrouped inline placeholders and code blocks still
follow it. With more than one form, or any authored group, ungrouped examples are left alone. The engine
has no group identity for inline code, so grouped inline placeholders are not annotated yet; this is a
known limit, not something the island guesses.

An input the declared `url`, `number`, or `boolean` type rejects is marked `aria-invalid`, shows its
localized message, sets `data-variables-invalid` on the form, and disables the copy buttons of terminals
in the same group. The output block's own copy button stays available because its text is author-supplied,
not derived from the inputs. Reset revalidates the group's defaults and announces itself in a live region.

## Keyboard and pointer

Keyboard and pointer input activate the same native controls. ⌘K on Apple platforms and Ctrl+K
elsewhere open search.

- Every copy result is written to a `role="status"` region. The same localized success and failure
  strings are used by the page copy control, the agent menu, the page footer, and the code/output
  copy islands, so a reader hears one vocabulary wherever the action was started.
- Buttons are native `<button>`s, disclosures use `<details>`/`<summary>`.

## Clipboard and security limits

- Copying needs a browser with `navigator.clipboard.writeText`, a secure context, and a user gesture.
  Without a clipboard the button stays hidden and the Markdown/provider links remain. A denied or
  failed write is announced as failure; the reader can select the text and copy it by hand.
- The page copy action fetches the Markdown twin once per click. It does not write cookies,
  localStorage, sessionStorage, or any other state. A failed request or a refused clipboard leaves
  the page intact and announces the failure.
- No documentation action executes a command. There is no run button, no shell, no child process,
  and no fetch of a command result. Recorded output is author-supplied text; changing an input marks
  it stale rather than re-running anything.
- Provider links and action templates are scheme-checked. A `javascript:`, `data:`, protocol-relative,
  or otherwise unsafe URL is dropped rather than rendered as a link. Values interpolated into a
  provider URL are percent-encoded once, and HTML text is escaped by the renderer.
- The only network requests a static page makes are the local Markdown twin after a click, the
  Pagefind index after search opens, and an embedded
  media provider after the reader presses its load control. Thumbnails, diagrams, and fonts are
  local; Mermaid renders at build time and the browser never loads Mermaid.
- The theme stores the color choice under `lateen-theme`. Source mode always starts off and is not stored.
