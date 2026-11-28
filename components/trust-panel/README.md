# Trust panel

A chip under the page title that opens a panel with the page's trust state, the examples it tested,
its drift status, its evidence and review coverage, its last reviewer, and why it has that state. The
chip is a native `<details>` summary, so the panel opens with Enter, Space, or a click and closes with
Escape when JavaScript runs; without it the panel is a native disclosure. The island also puts focus
back on the chip.

- `index.ts` renders the component from the view model's result; it never reads the site contracts
  itself. A page with no entry renders nothing, so a page with no trust record never gets a chip. An
  entry that is present but unreadable renders an `unknown` panel marked `data-trust-evidence="invalid"`,
  so a malformed record is reported instead of disappearing.
- `view-model.ts` is the pure selection boundary: it reads the page's entry from `site.data.trust`,
  keyed by `page.url`, or from the directive's props for a manual panel, and resolves the evidence,
  provenance dates, drift, reviewer, and action links into localised, render-ready rows
  (`trustPanelViewOf`). The evidence helpers (`trustEvidenceFor`, `provenanceOf`, `driftFor`,
  `actionHrefOf`, …) live here too and stay exported from `index.ts`.
- `styles/src/components.css` draws the chip and panel with Sailcloth tokens and logical properties.
  On screen, the panel floats below the chip, aligned to the reading direction. Evidence labels and
  values wrap within the card. In print, an open panel sits in the document flow below its chip.
- `chrome/trust-panel-keys/client.ts` is the island: Escape closes the open panel and puts focus back
  on the chip. It lives in `chrome/` because a layout draws the panel, and the engine loads a
  component's island only when page Markdown uses that component.
- `examples.ts` turns one page's `site.data.examples` entry into honest evidence: the tested-chip's
  run states plus the distinct `none`, `invalid`, and `absent` gaps, with the row's text, class, and
  `data-trust-examples*` attributes derived from it.
- `test/component-trust-panel.test.ts` covers absent versus malformed entries, every state, every
  evidence row, provenance, the action links, localisation, escaping, the island, and the
  stylesheet's tokens. `test/trust-panel-view-model.test.ts` covers the pure view model's selection
  for absent, invalid, full, and partial evidence.

## Data

The entry is either keyed by page URL directly or under `pages`; both shapes are accepted and the
nested one wins:

```yaml
# _data/trust.yml
"/guide/install/":
  level: verified
  reasons:
    - 3 of 3 examples passed
    - No drift findings
  lastReviewer: Ada Lovelace
```

```yaml
pages:
  "/guide/install/":
    level: unreviewed
    reasons: Reviewed more than 90 days ago.
```

Mizzen's computed entries show the evidence state, factors with their sources and availability, and
review coverage. A full `trust.json` report can also supply a build digest.

The published Mizzen `trust.json` report carries a SHA-256 build digest. When the site supplies
that report as `_data/trust.json`, the panel exposes the digest as `data-trust-build`. The
per-page entries Mizzen supplies during rendering are available before computing that digest.

The panel reads a review date from the author's recorded date in `_data/reviewers.yml`.
Mizzen accepts `{ date, author }` per page URL, or a `pages` list with a `url` on each entry.
For a report entry, the inline date must agree with the review evidence and precede or match the
report's `asOf` when supplied. The Reviewed row displays the date in the page's calendar and
keeps the exact ISO value in `datetime` and `data-trust-reviewed`.

A site may record a reviewed commit in `reviewedCommit` or the matching reviewer's `commit`.
When a GitHub or GitLab repository is configured, the Reviewed revision row links to that commit.

`level` names the state, strongest first:

| State | What it means |
| --- | --- |
| `verified` | All recorded evidence is present and clean: examples pass, drift is empty, and a reviewer signed off. |
| `partial` | Some recorded evidence is missing, failing, or out of date. |
| `unreviewed` | The evidence has not been reviewed, so no reviewer is recorded. |
| `unknown` | No evidence is recorded for the page. |

The names are matched without regard to case or surrounding spaces, and spaces and `_` read as `-`.
The first trust score's names still work: `review-due` reads as `unreviewed` and `at-risk` as
`partial`. A page with no entry for its URL stays hidden: absent data is not a claim either way. An
entry that is present but cannot be read — a bare string, list, number, or `null`, or a record with a
missing or unrecognised `level` — renders an `unknown` panel with `data-trust-evidence="invalid"` on
its root and the unknown explanation from the i18n table. That malformed entry supplies no reasons,
reviewer, build, dates, or actions, and the panel does not borrow the page's examples or drift either,
so none of its written fields can arrive as a valid trust claim. A manual panel with an unreadable
`level` is reported the same way; the directive cannot express "no level" and "malformed level"
differently, so only a present, unreadable level is marked invalid.

`reasons` is a list of sentences, or one string split on line breaks or `|`. `lastReviewer` is
optional. When an entry records no reasons, the panel shows the state's own explanation from the
i18n table, so every state is inspectable and never just a badge.

The examples row reads `site.data.examples`, keyed by page URL, and consumes `passed`, `failed`,
`total`, and `unrun` conservatively (`examples.ts`). The evidence states follow the tested-chip
contract: `passed`, `partial`, `unrun`, and `failed` for run results, plus three honest gaps the chip
does not have to show inline: `none` for a recorded suite that counted zero examples, `invalid` for
a report that cannot be read (a malformed count, a total smaller than the results, an `unrun` that
contradicts the total, or an entry that is not a record), and `absent` for no report at all. The row
names the state in words, as a class (`trust-panel-examples-<state>`) and as `data-trust-examples`
on the value; readable evidence also carries `data-trust-examples-passed`, `-failed`, `-total`, and
`-unrun`. A report with unrun examples always says so next to the run result, so it never reads as
fully passed, and invalid or absent evidence exposes no counts, so it can never look like a recorded
zero. Example evidence never changes the declared level. The drift row reads `site.data.drift`, keyed
by page URL (a list of findings); zero findings say so, a missing entry says the value is not
recorded.

## Options

The action links are optional and come from `theme.options.trust`. `{url}`, `{title}`, and
`{source}` are filled from the page; `{build}` and `{reviewed}` are filled from the
panel's valid provenance. Every value is percent-encoded, a root-relative URL gets the site's `base`,
and a template that asks for provenance the page does not have is left out rather than losing the
build context it promises.

```yaml
theme:
  options:
    trust:
      contextPackUrl: "https://example.com/context?page={url}&build={build}"
      suggestEditUrl: "https://github.com/example/docs/edit/main/{source}"
```

An unsafe value (`javascript:`, a protocol-relative path, a bare relative path) is dropped, and a
link with no configured URL is left out.

## Directive

The doc layout adds the panel automatically; a page that wants a manual one writes:

```markdown
:::trust-panel{level=verified reasons="3 of 3 examples passed|No drift findings" lastReviewer="Ada"}
:::
```
