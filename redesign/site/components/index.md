---
title: Components
description: The pieces a page uses inside its content. The engine turns a directive into the component whose folder has the same name.
layout: doc
permalink: /components/
redirect_from:
  - /blocks/
  - /blocks/audio/
  - /blocks/chart/
  - /blocks/citation/
  - /blocks/compare/
  - /blocks/download/
  - /blocks/gallery/
  - /blocks/hero/
  - /blocks/logos/
  - /blocks/people/
  - /blocks/pricing/
  - /blocks/pull-quote/
  - /blocks/stats/
  - /blocks/testimonial/
  - /blocks/timeline/
---

The pieces a page uses inside its content. The engine turns a directive into the component whose folder has the same name. `:::name` wraps a Markdown body. `::name` stands alone. Attributes are the options: `:::callout{type=warning}`.

## Code tabs

:::code-tabs{labels='["npm","pnpm","yarn"]'}
```sh
npx mizzen dev .
```

```sh
pnpm exec mizzen dev .
```

```sh
yarn mizzen dev .
```
:::

## In the library

<div class="list">
<a href="./callout/"><strong>Callout</strong><em>note, tip, important, warning, caution</em></a>
<div class="item"><strong>Badge</strong><span>A short status label, such as a version or a beta marker.</span></div>
<div class="item"><strong>Cards</strong><span>A responsive grid of linked cards, used by the home layout.</span></div>
<div class="item"><strong>Changelog entry</strong><span>One release with a version, a date, and categories.</span></div>
<div class="item"><strong>Charts</strong><span>Bar, stacked bar, and line charts, with the values kept in a table.</span></div>
<div class="item"><strong>Code</strong><span>Highlighted at build time, with a copy button when JavaScript runs.</span></div>
<div class="item"><strong>Code tabs</strong><span>The same example in several languages or package managers.</span></div>
<div class="item"><strong>Details</strong><span>A native disclosure the reader can open and close.</span></div>
<div class="item"><strong>Endpoint</strong><span>An HTTP method, path, parameters, and body.</span></div>
<div class="item"><strong>Figure</strong><span>An image with alt text, a caption, and a credit, in light and dark.</span></div>
<div class="item"><strong>File tree</strong><span>A folder structure with a note per entry.</span></div>
<div class="item"><strong>Kbd</strong><span>A keyboard key or a combination.</span></div>
<div class="item"><strong>Steps</strong><span>A numbered sequence. Digits follow the page language.</span></div>
<div class="item"><strong>Table</strong><span>A Markdown table in a labelled, keyboard-scrollable region.</span></div>
<div class="item"><strong>Terminal</strong><span>A shell session with commands and their output.</span></div>
</div>

## Around the title

<div class="item"><strong>Reading time</strong><span>A chip under the title with the reading time and the word count.</span></div>
<div class="item"><strong>Page status</strong><span>An experimental, beta, or deprecated banner from front matter.</span></div>
<div class="item"><strong>Stale notice</strong><span>A caution when the files a page covers changed after its review.</span></div>
<div class="item"><strong>Trust panel</strong><span>Opens the page’s trust level, examples, drift, reviewer, and actions.</span></div>
<div class="item"><strong>Heading anchor</strong><span>A link icon on every h2 to h4, added automatically.</span></div>

<div class="pills">
<span class="pill">Shipped</span>
<span class="pill">Pending</span>
<span class="pill ink">Blocked</span>
<span class="pill">Draft</span>
</div>

## On the page

These are the components the redesign theme ships. Each one is a folder under `redesign/components/`.

<div class="gallery">
<div class="specimen">
<h3>Badge</h3>
<div class="pills"><span class="pill">v0.2.3</span><span class="pill ink">beta</span></div>
</div>
<div class="specimen">
<h3>Status</h3>
<div class="pills"><span class="pill">Shipped</span><span class="pill">Pending</span><span class="pill ink">Blocked</span><span class="pill">Draft</span></div>
<p>Shipped is released. Pending waits on review. Blocked needs a change first.</p>
</div>
<div class="specimen">
<h3>Steps</h3>
:::steps
1. Install Lateen
2. Name the theme
3. Run mizzen dev
:::
</div>
<div class="specimen">
<h3>Kbd</h3>
<p>Press :kbd[⌘] :kbd[K] to search. Single keys are :kbd[/], :kbd[m], and :kbd[?].</p>
</div>
<div class="specimen">
<h3>Endpoint</h3>
::endpoint{method=GET path="/books/{id}" parameters='[{"name":"id","type":"string","required":true,"description":"hardcover or paper"}]'}
</div>
<div class="specimen">
<h3>File tree</h3>
:::file-tree
- site/
  - index.md
  - install.md
  - mizzen.yml
:::
</div>
<div class="specimen">
<h3>Details</h3>
:::details{summary="What the theme does not do" open}
It draws pages. The engine reads the files.
:::
</div>
<div class="specimen">
<h3>Check list</h3>
:::check-list
- Node 24 or later
- mizzen.yml in the folder
- A page of Markdown
:::
</div>
<div class="specimen">
<h3>Cards</h3>
<div class="mini-cards"><a href="../install/">Install<span>The quickstart</span></a><a href="../layouts/">Layouts<span>Page shapes</span></a></div>
</div>
<div class="specimen">
<h3>Changelog entry</h3>
:::changelog-entry{version="0.2.3" date="19 Nov 2026" categories="docs theme"}
:::
</div>
<div class="specimen">
<h3>Tags</h3>
::tags{items='["guide","reference","component"]'}
</div>
<div class="specimen">
<h3>Key-value</h3>
:::key-value
layout: doc
since: 0.2.0
status: shipped
:::
</div>
<div class="specimen">
<h3>Timeline</h3>
::timeline{items='[{"label":"0.2.3","detail":"Shipped"},{"label":"0.2.0","detail":"Tokens and callouts"}]'}
</div>
<div class="specimen">
<h3>Terminal</h3>
:::terminal
$ npx mizzen dev .
Lateen  ready on http://localhost:4173
:::
</div>
<div class="specimen">
<h3>Table</h3>
<div class="item"><strong>docs</strong><span>A documentation site</span></div>
<div class="item"><strong>changelog</strong><span>Release notes</span></div>
<div class="item"><strong>data</strong><span>A catalogue</span></div>
</div>
<div class="specimen">
<h3>Charts</h3>
::charts{title="Pages by section" rows='[{"label":"Install","value":12},{"label":"Layouts","value":28},{"label":"Components","value":46},{"label":"Tokens","value":22}]'}
</div>
</div>
