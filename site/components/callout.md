---
title: Callout
description: A note, tip, important point, warning, or caution with an icon and a color per kind.
layout: doc
permalink: /components/callout/
redirect_from:
  - /blocks/callout/
---

A callout sets a short passage apart from the prose: something to remember, try, or avoid. The five kinds match GitHub alerts, and both syntaxes render the same component.

## Kinds

:::callout{type=note title="A docs theme for people and agents"}
The theme draws the page. The engine reads the files.
:::

:::callout{type=tip title="Check the version first"}
The engine needs Node 24 or later.
:::

:::callout{type=important title="Customizable without forking"}
Tokens and options live in [one configuration file](/tokens/).
:::

:::callout{type=warning title="This option changes every page"}
Brand, logo, and footer apply to the whole site.
:::

:::callout{type=caution title="Deleting the folder cannot be undone"}
`danger` is read as the same kind as `caution`.
:::

## Syntax

A container directive:

```markdown
:::callout{type=warning title="Back up first"}
Run the migration on a copy of the database.
:::
```

A shortened directive, where the name is the type and the label is the title:

```markdown
:::tip[Check the version first]
The engine needs Node 24 or later.
:::
```

`:::note`, `:::tip`, `:::warning`, and `:::danger` (read as `caution`) all work this way. Text in
square brackets after the name is the title. The kind supplies the default title.

MkDocs Material's import names, including `:::abstract`, `:::success`, `:::question`, and
`:::failure`, use one of the same five variants. For a custom MkDocs type, use
`:::callout{type=custom}` to select the note fallback.

A GitHub alert:

```markdown
> [!TIP]
> Run the build before you open a pull request.
```

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `type` | `note`, `tip`, `important`, `warning`, or `caution` | `note` | The icon, color, and default title. `danger` is read as `caution`. |
| `collapsible` | flag | off | Renders the callout as a native disclosure. |
| `open` | flag | off | Starts a collapsible callout expanded. |
| `title` | string | the kind's name | Replaces the heading above the body, and is the callout's accessible name. |

The defaults are **Note**, **Tip**, **Important**, **Warning**, and **Caution**, read from `i18n/*.json` in the page's language. An author's `title` is shown as written. An unknown `type` falls back to `note`.

## Kinds and aliases

There are five kinds, the same five as GitHub alerts. Every other name below is an alias that is read as one of them, so a page imported from MkDocs keeps its meaning.

| Kind | Icon | Aliases |
| --- | --- | --- |
| `note` | Info | `info`, `todo`, `quote`, `cite`, `example` |
| `tip` | Lightbulb | `hint`, `success`, `check`, `done` |
| `important` | Message | `abstract`, `summary`, `tldr`, `question`, `help`, `faq` |
| `warning` | Triangle alert | `attention` |
| `caution` | Octagon alert | `danger`, `failure`, `fail`, `missing`, `error`, `bug` |

Names are matched without regard to case. A name that is neither a kind nor an alias is a `note`.

## Accessibility

- A standard callout is a named note. A collapsible callout takes its accessible name from the native summary and supports the browser’s keyboard interaction.
- The title element gets an id unique on the page: `callout-<type>-title` for the first callout of a kind, then `callout-<type>-title-2`, `-3`, and so on for repeats. A custom title does not change the scheme, so no two callouts share an id.
- A callout is not an alert and not a live region: it is announced where it sits in the reading order, and never interrupts. The icon is decorative (`aria-hidden`), since the title carries the meaning.
- The title is text, not HTML: an authored title is escaped, and mixed-direction titles keep the order the author wrote.

## Example

:::callout{type=tip title="Check the version first"}
The engine needs Node 24 or later. Run `node --version` before you install.
:::

:::callout{type=warning}
This option changes every page in the site.
:::

> [!CAUTION]
> Deleting the folder cannot be undone.

## Notes

- The body is Markdown, including paragraphs, lists, and code.
- A GitHub alert takes no options; its kind comes from the marker on the first line.
- The icon sits on the reading side in both directions, the frame is the same on every edge, and the icons are symmetric, so no separate right-to-left markup is needed.
