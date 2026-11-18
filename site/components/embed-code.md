---
title: Embed code
description: The code that embeds one of this site's pages elsewhere, in three formats, with a preview.
layout: doc
permalink: /components/embed-code/
---

An embed code turns an embedded page into a snippet another site can paste. It offers the `iframe`
itself, a static HTML copy, and the same copy as Markdown, so a site that blocks frames still has
something to use. The code is text: no script of ours runs on the host page.

## Syntax

```markdown
::embed-code{src="/embed-example/" title="Example page"}
```

The `src` names an embedded page: a site path or an absolute address. The component reads that
page's title, description, `embedded` front matter, and published size and colour scheme, so the
snippet and the preview always describe the same view.

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `src` | string | none | The embedded page to show code for. A site path such as `/embed-example/` or an absolute `https` address. |
| `title` | string | the embedded page's title | The frame's accessible name. |

## Example

::embed-code{src="https://velella.sh/lateen/embed-example/" title="Embed example"}

The frame snippet names the page's absolute address, its title, its declared height, `loading="lazy"`,
and a `sandbox`. The HTML and Markdown panels carry the same title, the page's description and
`embedded.facts`, and a link to the full page. They are copies: the note beside them says they do
not update when the page changes.

## Without JavaScript

Every format is visible at once, one panel after the other. The preview button is absent, and the
link to the embedded page opens it in a new tab, so a reader can still see the view before copying
the code.

## Notes

- Set `url` in the site configuration. Without it the component cannot build an absolute address and
  says so instead of showing code that would not work.
- A page that publishes several embedded views of the same full page, such as a light and a dark
  one, gets a variant choice: the snippet and the preview change together.
- Use the frame snippet for a live view, and the HTML or Markdown copies when the host's security
  policy blocks frames. Only the frame always shows the current page.
