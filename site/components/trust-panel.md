---
title: Trust panel
description: A chip under the title that opens the page's trust level, examples, drift, evidence and review coverage, reviewer, and actions.
layout: doc
permalink: /components/trust-panel/
---

A trust panel tells a reader how much to trust a page: the examples it tested, whether it has drifted
from the code it describes, who reviewed it last, which build produced the evidence, and why the page has its level. The doc layout puts the chip under
the title automatically when the page has an entry in `site.data.trust`; a page without an entry gets no
chip. An entry that is present but cannot be read still gets a chip: it shows the unknown level and an
explicit invalid-evidence marker, so a data-quality problem is visible instead of silent.

## Syntax

The layout adds it automatically. For a manual panel inside a page:

```markdown
:::trust-panel{level=verified reasons="3 of 3 examples passed|No drift findings" lastReviewer="Ada Lovelace"}
:::
```

The layout's panel reads the page's entry from `site.data.trust`, keyed by URL:

```yaml
# _data/trust.yml
"/guide/install/":
  level: verified
  reasons:
    - 3 of 3 examples passed
    - No drift findings
  lastReviewer: Ada Lovelace
```

The entry also works under a `pages` key, which matches the structure of Mizzen's `trust.json` report.
For a report entry, the disclosure starts with the evidence state for examples, drift, and review.
It then shows each factor with its source and availability, followed by review coverage. The
published report's build digest can identify the evidence when a site supplies the full report.
The report does not provide generation or review timestamps.

An entry that is present but unreadable — a bare string, list, number, or `null`, or a record with a
missing or unrecognised `level` (a manual panel with an unreadable `level` behaves the same way) — is
reported instead of hidden. The panel shows the unknown level and the unknown explanation, and marks
the root with `data-trust-evidence="invalid"` alongside `data-trust-level="unknown"`. A malformed
entry never contributes its own reasons, reviewer, build, dates, or action placeholders, and the panel
does not show the page's examples or drift beside it, so none of it can read as a valid trust record.
A page with no entry at all stays hidden.

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

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `level` | `verified`, `review due`, or `at risk` | none | The chip's level. Spaces, case, and `_` are ignored. A present value that names no level renders an unknown panel marked invalid. |
| `reasons` | list, or a string split on line breaks or `|` | none | Why the page has this level. |
| `lastReviewer` | string | none | Who reviewed the page last. |
| `reviewedCommit` | string | none | The commit the review covered. |

The examples row reads `site.data.examples` by page URL (`passed`, `failed`, `total`, `unrun`) and
reports the evidence conservatively, in the tested chip's states: `passed`, `partial`, `unrun`, and
`failed`. A report that counted more examples than it ran reads as `partial` and says how many did
not run, so it never reads as fully passed; a suite that counted examples but completed none reads as
`unrun`. A report with failures keeps the `failed` state even beside unrun examples. The row says so
in words even when the evidence is not a run result: `Not recorded` when the page has no report,
`No examples recorded` when a report counted zero examples, and `Unknown` when the report was written
but cannot be read (a malformed count, a total smaller than the results it counts, or an `unrun`
that contradicts the total). Invalid and absent evidence expose no counts at all, so unreadable
evidence can never look like a recorded zero.

The state is available to machine readers on the examples row: `data-trust-examples` names the state
(`passed`, `partial`, `unrun`, `failed`, `none`, `invalid`, `absent`), and readable evidence adds
`data-trust-examples-passed`, `-failed`, `-total`, and, when some did not run, `-unrun`. The row's
class carries the same state (`trust-panel-examples-partial`). Example evidence never changes the
declared trust level, in any state.

The drift row reads `site.data.drift` by page URL. A missing value says it is not recorded.

The action links are optional, from `theme.options.trust`; `{url}`, `{title}`, `{source}`, `{build}`,
and `{reviewed}` are filled from the page and its valid provenance, and a root-relative
URL gets the site's `base`:

```yaml
theme:
  options:
    trust:
      contextPackUrl: "https://example.com/context?page={url}&build={build}"
      suggestEditUrl: "https://github.com/example/docs/edit/main/{source}"
```

Every placeholder value is percent-encoded. A link whose option is missing, whose value is not a site
path or an `https` URL, or that asks for provenance the page does not have, is left out.

## Example

:::trust-panel{level=verified reasons="3 of 3 examples passed|No drift findings" lastReviewer="Ada Lovelace"}
:::

:::trust-panel{level=review-due reasons="Reviewed more than 90 days ago."}
:::

## Notes

- The chip is a native `<details>` summary, so it opens and closes with Enter, Space, or a click. When
  JavaScript runs, Escape also closes it and returns focus to the chip, and a link to `#trust-panel`
  opens the panel; without JavaScript the browser keeps Escape for itself, while the panel content
  stays readable and printable.
- The examples evidence, its state, and its counts are in the server-rendered row: with no JavaScript
  the reader and any scanner still see `partial`, `unrun`, `invalid`, and `absent` honestly.
- The text comes from `i18n/*.json` in the page's language, and the panel uses logical properties, so
  it works under RTL. Unreviewed, unknown, and failed evidence each keep a distinct localised word and
  icon shape, so the state never depends on colour.
- Writing `trust.json` per page is a separate issue (N14). Until it lands, the layout's panel stays
  hidden unless the site writes `_data/trust.yml` or a page writes the directive.
