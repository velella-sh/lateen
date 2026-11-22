---
title: Glossary
description: Every term as a lettered list, and inline terms that open their definition in place.
layout: doc
permalink: /components/glossary/
---

A glossary has two parts: a list of every term, and inline terms in the prose. Both read one data collection, so a definition is written once. The inline term is a native disclosure: the label opens its definition in place, with no JavaScript and no tooltip.

## Syntax

The list component is a leaf directive:

```markdown
::glossary
```

An inline term is a text directive: the label in brackets, and the term's record id as its option.

```markdown
The :term[Latency]{id=latency} is the delay before the response.
```

The label is ordinary inline Markdown. Without an `id`, the theme looks the label up by the term's text or one of its other names, so `:term[delay]` finds the latency entry.

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `id` | string | the label text | The term's record id. When it names no term, the label is shown as text with a marker. |

## Theme options

These options are read from the site config, not written on the directive.

| Option | Type | What it does |
| --- | --- | --- |
| `glossary.collection` | string | The collection holding the terms. Its fields are `term`, `definition`, and `aliases`. |
| `glossary.page` | string or language map | The address of the page that carries `::glossary`. A term links to `page#id`. A site under a base path gets the base added. |

A language map names one address per language and falls back to the site's default language:

```yaml
theme:
  options:
    glossary:
      collection: glossary
      page:
        en: /glossary/
        fa: /fa/glossary/
```

Without `glossary.page`, a term links to its own record page when the collection builds pages. With neither, the label still opens the definition and the panel has no link.

## Example

The :term[Latency]{id=latency} of a request is separate from its :term[throughput]. A :term[cache] keeps a copy ready. Write a term that the collection does not define as :term[quantum flux], and the words stay on the page with a visible marker.

::glossary

## Without JavaScript

The label is a button. A tap, a click, Enter, or Space opens the definition in a native popover, and Tab can reach the glossary link. Escape or an outside click dismisses it. Browsers without native popovers show the definition and link inline.

## Accessibility

- The summary is the only control, so the term adds no tab stop to a closed page and traps no focus.
- The unknown marker is a visible `?` plus a sentence read by a screen reader.
- The panel follows the page direction, and its link has a visible focus ring.
- On a narrow screen the panel moves into the text flow, so a long definition and its link stay inside the viewport.
