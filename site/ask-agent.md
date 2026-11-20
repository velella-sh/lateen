---
title: Ask your agent
description: Hand a search question to an agent you already use, with the related pages and their Markdown text, without the site sending anything.
layout: doc
permalink: /ask-agent/
---

Lateen can hand a question from search to an agent you already use. The theme builds a prompt in your
browser from the question and the pages the site published, then lets you copy it or open it in a
configured agent. The site itself sends nothing anywhere.

## Try it

Open search with <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>⌘</kbd>+<kbd>K</kbd> on a Mac) or press
<kbd>/</kbd>, then type a question of at least two words, such as "how do I install the theme". The
last row in the list is **Ask your agent about “…”**. Choosing it opens the prompt panel.

The search results page offers the same panel under its results, for readers who never open the
dialog.

## What the prompt contains

```text
You are helping me with a question about the Example documentation.

Question: how do I install the theme

Related pages:
- Install and quickstart — /install/ (Markdown: /install/index.md)
- Layouts — /layouts/ (Markdown: /layouts/index.md)

Site index: https://example.com/llms.txt
```

Each related page contributes its title, its address, and its Markdown twin when the site publishes
twins. The site index line appears only on a site that publishes `llms.txt`. The prompt is plain text. The question is kept as you typed it, and nothing the site did not
publish is added.

## Panel actions

| Action | What it does |
| --- | --- |
| **Copy prompt** | Copies the prompt and announces whether it worked. |
| **Include page text** | Fetches the Markdown twin of each shown page and adds its text, up to the character limit. Nothing is fetched until you turn it on. |
| **Open in** | Follows an agent link that carries the prompt in its address. |

The panel shows the prompt's size before you copy it.

## Limits

| Limit | Value | What happens |
| --- | --- | --- |
| Related pages | 5 | The prompt says only the first five pages are included. |
| Page text | 12,000 characters | Text is cut and the prompt names the pages that were left out. |
| Agent link | 8,000 characters | The link is not opened; the prompt is copied and the panel says why. |

## Providers

The agents in the panel come from `theme.options.pageAgent.providers`. A provider is offered only
when its URL contains `{prompt}` and no other placeholder, so a link is never half-filled:

```yaml
theme:
  options:
    pageAgent:
      providers:
        - title: Claude
          url: "https://claude.ai/new?q={prompt}"
        - title: ChatGPT
          url: "https://chatgpt.com?q={prompt}"
```

A provider that takes `{markdown}` stays in the page agent menu and is left out of the ask panel,
because a prompt is not a page. A site that configures no prompt provider keeps the copy action and
shows no agent links.

## Without JavaScript

The search dialog and its ask row do not exist without JavaScript. The search results page keeps a
static section that explains the feature and links `llms.txt` when the site publishes it, so a reader
without JavaScript still learns where the machine-readable text is. The section stays out on a site
that publishes no Markdown twins, because there is no prompt to offer there.

## Privacy

The site sends nothing: no query leaves the browser, no prompt is uploaded, and no AI service runs
here. Page text is fetched from the site's own Markdown twins only after **Include page text** is on.
Following an agent link hands the prompt to that agent's site, the same as typing it there yourself.

## Notes

- An empty search names the scope it searched: **This project** or **All projects**.
- The empty state links to the same query in the other scope, so a reader can widen or narrow it without
  retyping.
- The feature uses the search dialog the theme already ships; there is no second dialog.
- The row appears only for a question of two words or more, so an ordinary one-word lookup stays a
  lookup.
- A page without a Markdown twin contributes its title and address, and no page text.
