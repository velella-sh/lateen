---
title: Components
description: Every component the Lateen theme provides, with its syntax, options, and a live example.
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

Components are the pieces pages use inside their content: a callout, a code tab, an endpoint, a file tree. Each page below shows the Markdown you write, every option it reads, and a live example.

The engine turns a directive into the component whose folder has the same name under `components/`. A container directive (`:::name` … `:::`) wraps a Markdown body; a leaf directive (`::name`) stands alone on its own line. Directive attributes are the component's options: `:::callout{type=warning}`.

Source mode, the `file:line` view of every block, is described on [Source mode](https://velella.sh/lateen/source-mode/); its switch is part of every page, not a directive.

The theme's own look is set with the [Brand options](https://velella.sh/lateen/brand-options/); the shipped starting points are on [Presets](https://velella.sh/lateen/presets/).

| Component | Use it for |
| --- | --- |
| [Add to calendar](https://velella.sh/lateen/components/add-to-calendar/) | A download link for a record's `.ics` file and a subscribe link for its calendar. |
| [Badge](https://velella.sh/lateen/components/badge/) | A short status label, such as a version or a beta marker. |
| [Callout](./callout/) | A note, tip, important point, warning, or caution. |
| [Cards](https://velella.sh/lateen/components/cards/) | A responsive grid of linked cards, used by the home layout. |
| [Changelog entry](https://velella.sh/lateen/components/changelog-entry/) | One release with a version, a date, and categories. |
| [Charts](https://velella.sh/lateen/components/charts/) | Bar, stacked bar, and line charts drawn at build time, with their values in a table. |
| [CLI demo](https://velella.sh/lateen/components/cli-demo/) | A terminal session and an install command as fixed, copyable text. |
| [Code](https://velella.sh/lateen/components/code/) | Code highlighted at build time, with a copy button when JavaScript runs. |
| [Code tabs](https://velella.sh/lateen/components/code-tabs/) | The same example in several languages or package managers, as tabs. |
| [Data explorer](https://velella.sh/lateen/components/data-explorer/) | Search, filter, and sort a collection in the browser, with a search page fallback. |
| [Compare](https://velella.sh/lateen/components/compare/) | Records side by side, with the differing rows marked. |
| [Dated list](https://velella.sh/lateen/components/dated-list/) | Records grouped by month in the page language's calendar. |
| [Details](https://velella.sh/lateen/components/details/) | A native disclosure that the reader can open and close. |
| [Diff block](https://velella.sh/lateen/components/diff-block/) | Added, removed, and context lines, with a copy of the new file. |
| [Drift banner](https://velella.sh/lateen/components/drift-banner/) | A warning above a page whose documentation has drifted from the code. |
| [Embed](https://velella.sh/lateen/components/embed/) | A video or another page in a lazy iframe. |
| [Embed code](https://velella.sh/lateen/components/embed-code/) | The snippet that embeds one of this site's pages elsewhere, with a preview. |
| [Endpoint](https://velella.sh/lateen/components/endpoint/) | An HTTP method, path, parameters, and body for API reference pages. |
| [Figure](https://velella.sh/lateen/components/figure/) | An image with alt text, a caption, and a credit, in light and dark. |
| [File tree](https://velella.sh/lateen/components/file-tree/) | A folder structure with a note per entry. |
| [Gallery layout](https://velella.sh/lateen/components/gallery/) | A collection as cards, with facet filters, a sort choice, a count, and an empty note. |
| [Glossary](https://velella.sh/lateen/components/glossary/) | Every term as a lettered list, and inline terms that open their definition in place. |
| [Guide layout](https://velella.sh/lateen/components/guide/) | A layout for step-by-step guides, with a summary bar and related guides. |
| [Heading anchor](https://velella.sh/lateen/components/heading-anchor/) | A link icon on every h2 to h4, added automatically. |
| [Kbd](https://velella.sh/lateen/components/kbd/) | A keyboard key or key combination. |
| [Key-value list](https://velella.sh/lateen/components/key-value/) | Properties, options, or metadata as a two-column list of keys and values. |
| [Link card](https://velella.sh/lateen/components/link-card/) | One link that reads as a card, for next steps and related pages. |
| [Mermaid](https://velella.sh/lateen/components/mermaid/) | A Mermaid diagram rendered to inline SVG at build time, with its source kept. |
| [OS tabs](https://velella.sh/lateen/components/os-tabs/) | Install instructions grouped by operating system, defaulting to the reader's system. |
| [Output block](https://velella.sh/lateen/components/output-block/) | The result of a command, apart from the command above it. |
| [Network chrome](https://velella.sh/lateen/components/network/) | A project switcher, a network footer, and a scope choice for a site in a network. |
| [Page status](https://velella.sh/lateen/components/page-status/) | An experimental, beta, or deprecated banner from front matter. |
| [Preset preview](https://velella.sh/lateen/components/preset-preview/) | One preset of the theme in its own scoped block, with the options to copy. |
| [Reading time](https://velella.sh/lateen/components/reading-time/) | A chip under the title with the page's reading time and word count. |
| [Record history](https://velella.sh/lateen/components/record-history/) | A record's own change events, newest first, with old and new values. |
| [Report issue](https://velella.sh/lateen/components/report-issue/) | A prefilled link that opens an issue for the current page. |
| [Reports](https://velella.sh/lateen/components/reports/) | An accessibility report, a performance budget, and the WCAG checklist, from site data. |
| [Schema table](https://velella.sh/lateen/components/schema-table/) | A JSON Schema from `_data` as a table of properties. |
| [Stale notice](https://velella.sh/lateen/components/stale-notice/) | A caution note under the title when a page's covered files changed since its review. |
| [Status](https://velella.sh/lateen/components/status/) | A short status label with a tone and icon, and a legend of the site's status values. |
| [Status banner](https://velella.sh/lateen/components/status-banner/) | A page-level deprecated, experimental, or old-version banner, with a replacement link. |
| [Steps](https://velella.sh/lateen/components/steps/) | A numbered sequence or tutorial. |
| [Symbol popover](https://velella.sh/lateen/components/symbol-popover/) | A symbol whose signature and reference page appear on hover or focus. |
| [Table](https://velella.sh/lateen/components/table/) | Markdown tables in a labelled, keyboard-scrollable region. |
| [Tabs](https://velella.sh/lateen/components/tabs/) | Any sections as tabs, following one chosen label across the page and later pages. |
| [Tags](https://velella.sh/lateen/components/tags/) | A wrapping list of tag chips, as links or plain text. |
| [Terminal](https://velella.sh/lateen/components/terminal/) | A shell session with commands and their output. |
| [Tested chip](https://velella.sh/lateen/components/tested-chip/) | The pass or fail result of a page's examples, next to a code block. |
| [Timeline](https://velella.sh/lateen/components/timeline/) | Rows on one time axis, with phases, status tones, and a readable table. |
| [Trust panel](https://velella.sh/lateen/components/trust-panel/) | A chip under the title that opens the page's trust level, examples, drift, reviewer, and actions. |
| [Variables form](https://velella.sh/lateen/components/variables-form/) | Inputs that fill a page's code-example variables with the reader's own values. |
| [Version badge](https://velella.sh/lateen/components/version-badge/) | A version badge that says when a feature was added, changed, or removed. |
| [Version diff](https://velella.sh/lateen/components/version-diff/) | A section-by-section comparison of two versions, with a text label for every change. |
| [Video](https://velella.sh/lateen/components/video/) | A click-to-load video with a poster and a link that works without JavaScript. |
