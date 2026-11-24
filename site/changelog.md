---
title: Changelog
description: What changed in Lateen, release by release. Dates are UTC.
layout: changelog
permalink: /changelog/
releases:
  - version: 0.2.5
    date: 2026-11-24
    categories: Added,Changed,Fixed
    body: |
      <p>Adds opt-in Velella family presets, Theme Studio for trying presets, colors, and fonts, schema fields on collection and record pages, and links to the versioned data API.</p>
      <p>Groups Page tools, calms the navigation chrome around the article, and gives every page one type and rhythm system. Fixes boolean schema references, reproducible syntax highlighting, and the edit link on aggregate records.</p>
      <p><a href="https://github.com/velella-sh/lateen/blob/main/CHANGELOG.md">Read the complete package changelog</a>.</p>
  - version: 0.2.4
    date: 2026-11-22
    categories: Added,Changed,Fixed
    body: |
      <p>Polishes the doc chrome: callouts, sidebar and table-of-contents markers, a Page tools menu, search, and the end-of-article pager.</p>
      <p>Removes the page feedback widget and the per-block edit button. A <code>theme.options.feedback</code> block is still accepted and ignored. Adds a <code>quote</code> component, figures with several images, and release gates for the exact candidate commit.</p>
      <p><a href="https://github.com/velella-sh/lateen/blob/main/CHANGELOG.md">Read the complete package changelog</a>.</p>
  - version: 0.2.3
    date: 2026-11-19
    categories: Added,Changed,Fixed
    body: |
      <p>Adds record, list, blog, API reference, gallery, guide, and embedded layouts; data, evidence, command, and embed components; starters, theme overrides, and visual gates.</p>
      <p>Refines tokens, components, and chrome, completes English, Persian, and Arabic translations, and fixes oversized fallback fonts. This release requires <code>@velella/mizzen@^0.2.5</code>.</p>
      <p><a href="https://github.com/velella-sh/lateen/blob/main/CHANGELOG.md">Read the complete package changelog</a>.</p>
  - version: 0.2.2
    date: 2026-11-14
    categories: Changed
    body: |
      <ul>
        <li>Moves the code copy control to a small icon button inside the block, with a localized accessible name and no-JavaScript fallback.</li>
        <li>Places reading time as quiet metadata under the title.</li>
      </ul>
  - version: 0.2.1
    date: 2026-11-14
    categories: Fixed
    body: |
      <ul>
        <li>Loads component styles on every page, including components rendered directly by layouts.</li>
        <li>Restores code copy and trust-panel keyboard behavior, fixes changelog label contrast, and keeps repeated version-diff ids unique.</li>
        <li>Applies the site base path to root-relative images and media.</li>
      </ul>
  - version: 0.2.0
    date: 2026-11-13
    categories: Added,Changed,Fixed
    body: |
      <p>The first complete Lateen theme, with layouts, chrome, components, search, agent actions, trust evidence, internationalization, RTL, and accessibility and performance gates.</p>
      <p>Every layout, chrome unit, and component covers keyboard, no-JavaScript, right-to-left, print, and agent paths.</p>
---
