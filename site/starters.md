---
title: Starters
description: Three complete sites that ship with Lateen, each one built and served here as a live demo.
layout: doc
permalink: /starters/
---

A starter is a complete small site someone copies to begin their own. Lateen ships three; each one is
built and served below, and the source is the folder linked from its demo.

| Starter | What it is | Demo |
| --- | --- | --- |
| `docs` | A documentation site for one tool: home page, getting started, two reference pages, a changelog and a not-found page. | [/lateen/starters/docs/](https://velella.sh/lateen/starters/docs/) |
| `changelog` | A release notes site for one product: a home page that points at the latest release, a changelog, a versions page, a feed page and a guide to adding a release. | [/lateen/starters/changelog/](https://velella.sh/lateen/starters/changelog/) |
| `data` | A data site for one invented catalogue: record pages, a list page, a timeline, a data explorer and a guide to changing the data. | [/lateen/starters/data/](https://velella.sh/lateen/starters/data/) |

Every demo is a build of the folder in `starters/` at the same commit, with its base set to the demo
path and `noindex` on every page. A starter that fails its check is not published.

## Start from one

```sh
npx mizzen init my-site --theme node_modules/@velella/lateen --starter docs
```

The source of each starter is on GitHub: [docs](https://github.com/velella-sh/lateen/tree/main/starters/docs),
[changelog](https://github.com/velella-sh/lateen/tree/main/starters/changelog), and
[data](https://github.com/velella-sh/lateen/tree/main/starters/data).
