---
title: Status
description: A small status label with a tone, an icon, and a page-language label, plus a legend of the site's status values.
layout: doc
permalink: /components/status/
---

A status is a small label for the state of a thing: done, late, draft. Each tone has its own icon and text, so a reader never needs colour to tell them apart. Two directives use it: the `::status[text]{tone=positive}` badge, and the `::status-legend`, which lists the values your site maps.

## Syntax

```markdown
::status[Done]{tone=positive}

::status{value=shipped}

::status-legend
```

## Status options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `tone` | `positive`, `caution`, `negative`, `neutral`, or `info` | `neutral` | The colour and icon. An unknown value is neutral. |
| `label` | string | empty | The text shown when the directive has no body. |
| `value` | string | none | A data value looked up in `theme.options.status.values`; it supplies the tone and the label. |

The text between the brackets is the label. Both directives are block-level: put each on its own line, with a blank line before and after. A `value` wins over `tone` and over the body text.

## Status legend options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `values` | comma-separated values | every mapped value | The subset to list, in this order. Blank, repeated, and unmapped values are skipped. |

## Theme options

The site maps its own data values under `theme.options.status.values`. The theme ships no defaults, so a site with no map renders no legend and shows every `value` as written, in neutral.

```yaml
theme:
  options:
    status:
      values:
        shipped:
          tone: positive
          label:
            en: Shipped
            fa: ارسال شد
          description: The work is done and released.
        pending:
          tone: caution
          label: Pending
          description: Waiting on a review.
        blocked:
          tone: negative
          label:
            en: Blocked
            fa: مسدود
          description: Something must change first.
        draft:
          tone: info
          label: Draft
```

| Key | What it does |
| --- | --- |
| `tone` | One of the five tones. Missing or unknown is `neutral`. |
| `label` | A string for every language, or a table from language code to text. The page's language is tried first, then its primary subtag (`fa-IR` reads `fa`), then English. With no label for the language, the raw value is shown. |
| `description` | The same two forms. The legend shows it after the badge; a value without one shows the badge alone. |

## Example

Every tone, with its icon and its text label:

::status[Done]{tone=positive}

::status[Check]{tone=caution}

::status[Late]{tone=negative}

::status[Archived]{tone=neutral}

::status[Info]{tone=info}

```markdown
::status[Done]{tone=positive}

::status[Check]{tone=caution}

::status[Late]{tone=negative}

::status[Archived]{tone=neutral}

::status[Info]{tone=info}
```

A mapped value takes both its tone and its label from the site's options, so the same word reads in the page's language:

::status{value=shipped}

::status{value=pending}

::status{value=blocked}

::status{value=draft}

```markdown
::status{value=shipped}

::status{value=pending}

::status{value=blocked}

::status{value=draft}
```

An unmapped value is not an error: it shows as written, in neutral.

::status{value=in-review}

The legend lists every mapped value in map order, each as the badge above followed by its description:

::status-legend

```markdown
::status-legend
```

Pass `values` to choose and order a subset:

::status-legend{values="blocked, shipped"}

```markdown
::status-legend{values="blocked, shipped"}
```

## Without JavaScript

Both directives render at build time to plain HTML and CSS. The icon is inline SVG, marked `aria-hidden`, and the label is real text, so a reader without JavaScript sees exactly the same badge and legend. Nothing is fetched, toggled, or remembered in the browser.

## Notes

- The badge is a label, not a link, and it is block-level. For a status inside a sentence, write the text and link the thing it names around it.
- Do not use the single-colon `:status` form: the engine reads the two-colon leaf form only.
- Colour is decoration: the icon and the text carry the meaning in every tone, including in forced-colours mode and in print.
- The legend is a list, so a screen reader hears how many values the site defines. It renders nothing when the site maps no value.
- Keep the mapped values short. They appear inside sentences as well as in the legend.
