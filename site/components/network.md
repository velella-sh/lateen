---
title: Network chrome
description: A project switcher, a network footer, and a search scope for a site that belongs to a network of projects.
layout: doc
permalink: /components/network/
---

When a site is one project of a network, Mizzen gives the theme the public projects in
`Site.network`. Lateen renders three pieces from that input: a project switcher in the header or
the footer, a network footer that lists the same projects, and a search scope choice between this
project and all projects. A site without a network, or with one project, renders none of them.

Every name and address comes from the network file. The theme writes no project name of its own and
adds no tracking parameter.

## Example

A site named Alpha, in a network with Beta Docs and Gamma, sets the network in `mizzen.yml`:

```yaml
network:
  source: network.yml
  project: alpha
```

The header then shows a **Projects** disclosure with three links, Alpha marked as the current page
with `aria-current`. The footer repeats the same three links under the same label. On the search
results page, two radio choices sit beside the search field: **This project** and **All projects**.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `theme.options.network.switcher` | boolean | `true` | Shows the project switcher. Set it to `false` to leave the switcher out while keeping the network footer and the search scope. |
| `theme.options.network.footer` | boolean | `true` | Shows the network footer. Set it to `false` to leave the footer list out. |
| `theme.options.network.search` | boolean | `true` | Lets the reader search the entire network. Set it to `false` for project-only search. |
| `theme.options.network.position` | `header` or `footer` | `header` | Places the switcher in the header or above the network footer. Any other value stops the build with a message that names this option. |

```yaml
theme:
  options:
    network:
      switcher: true
      footer: true
      position: header
```

Set **theme.options.network.search** to false to keep the switcher and footer and search only the current project.
The header and results page omit the scope choice and use the local index even if an old URL specifies all projects.

## Without JavaScript

The read path needs no script. The project switcher is a native `<details>` and `<summary>`: a
reader opens it and follows ordinary links, each to that project's home. The network footer is a
plain list of the same links. The search scope is two radio buttons named `scope`, so submitting the
search results form carries `scope=project` or `scope=all` in the address.

A browser with JavaScript adds the conveniences a menu of links expects: Escape closes the
switcher and returns focus to its summary, the arrow keys move through the links, and a click
outside or a focus that leaves closes it. Focus is never trapped. Picking **All projects** loads the
other public projects' indexes and adds their results, each labelled with its project's title; the
retry link reloads the same scope when one index fails.
