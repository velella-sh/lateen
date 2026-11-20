---
title: Accessibility
description: How the Lateen theme is tested against WCAG 2.2 AA, and what is checked by hand.
layout: doc
permalink: /accessibility/
---

This page lists the WCAG 2.2 success criteria at levels A and AA that the Lateen theme is tested against, and how each is tested. It is written from the gates in this repository and published with each release. It is not an audit by a third party.

## The accessibility gate

`npm run test:a11y` builds the Lateen docs site and a small fixture site, serves them on a loopback port, and runs [axe-core](https://github.com/dequelabs/axe-core) in Chromium through [`@axe-core/playwright`](https://github.com/dequelabs/axe-core-npm). It runs the WCAG 2.2 A and AA rules.

The matrix is 50 page states, covering:

- **Every layout:** api, changelog, doc, home, not-found, search-results, tutorial, and versions.
- **Every theme:** light and dark, set the way the theme switch stores the choice.
- **Every locale:** English and the right-to-left Persian and Arabic pages, including a report page in each that uses all three report components.
- **Component states:** code tabs, disclosures closed and open, tabs, a terminal, a table, a form, and callouts.
- **Open overlays:** the mobile drawer and the search palette.

A new **critical or serious** violation fails the run. Moderate and minor findings do not fail it, because axe finds only part of the problems for any criterion. Violations that existed when the gate was added are listed in [`test/accessibility/baseline.json`](https://github.com/velella-sh/lateen/blob/main/test/accessibility/baseline.json); the gate fails on anything not listed there. Fixing one of them is worth doing, and its entry is then removed.

### Run it

From a clean checkout on Node 24:

```bash
npm ci
npx playwright install chromium
npm run test:a11y
```

On Linux, `npx playwright install --with-deps chromium` also installs the system libraries the browser needs; CI does this. The Playwright version is pinned in `package-lock.json`, so the browser download is reproducible.

To reproduce one failure without running the whole matrix, filter by case name:

```bash
npm run test:a11y -- --only "docs home"
```

Add `--report <file>` to write the whole run as JSON, validated against
[`schema/a11y-report.schema.json`](https://github.com/velella-sh/lateen/blob/main/schema/a11y-report.schema.json).
The deploy does this on the commit it publishes.

The failing output names the case, the theme, the rule, and the element's selector, plus axe's help link. CI runs the same command in the `a11y` job of `.github/workflows/ci.yml`.

## What automation cannot check

axe checks the rules it has; a pass is not an audit. A person still reviews each release for what a browser rule cannot see:

- **Screen reader reading order and announcements.** Follow the skip link, the sidebar, search, the drawer, and code tabs with a screen reader.
- **Resize, reflow, and text spacing.** Check 200% zoom, a 320 px wide window with no sideways scroll, and a text-spacing override.
- **Non-text contrast, hover and focus content, and focus not obscured.** Check focus rings, popovers, the sticky header, and the sidebar against a focused link.
- **Keyboard traps and focus order.** Open every overlay, tab through it, and close it with Escape.
- **Language of parts and consistent navigation.** Read mixed-direction text and compare the navigation across pages.
- **Footnote return links.** A footnote with several references returns to the exact one activated. Each return link has its own accessible name.

## Checklist

Every WCAG 2.2 level A and AA success criterion is listed once, grouped by principle, with how
Lateen checks it and the evidence behind a manual check. A criterion that does not apply to a docs
theme says why. No criterion text is copied here: each row links to the W3C's own wording. A manual
check with no recorded date, version, and evidence reads "not recorded yet", so the list never
claims a check that did not happen.

::wcag-checklist{from=wcag}

## This site's report

The deploy runs the accessibility gate on the commit it publishes, writes the report into the site's
data before the build, and the page shows that commit. When you read this page from a checkout
that has not run the gate, the section says the report is missing instead of showing an old one.

::a11y-report{from=accessibility-report}

Every release's stored reports are on the [reports page](/reports/).

## Release candidate QA record

`0.2.2` was checked in Chromium against the built docs site and `fixtures/integration`, on Node 24
with `@velella/mizzen` 0.2.0:

| Check | Result |
| --- | --- |
| Keyboard order, visible focus ring, skip link, focus return from search and drawer | pass (40 tab stops, no stop on hidden or unfocused content) |
| Copy, block-action, and variable journeys by keyboard and pointer | pass (Markdown twin, commands only, author output, source + language + version prompt) |
| Grouped examples, typed validation, and per-group reset | pass (two independent groups, visible localized error, terminal copy blocked only in the invalid group, stale output scoped, reset announced) |
| 200% text zoom | pass (no sideways scroll, no clipped prose) |
| 320 px reflow, LTR and RTL | pass (no page scroll; code and tables scroll inside their own regions; the version popover stays inside the viewport) |
| Reduced motion | pass (motion tokens collapse to `0s`, no animated surface) |
| Forced colors and print | pass (evidence keeps its words; screen-only controls are hidden) |
| JavaScript disabled | pass (full prose and code, no dead copy control) |
| Right-to-left chrome | pass (`dir=rtl`, localized names, code and identifiers stay LTR) |
| Screen reader reading order and announcements | **not executed in this environment**; a person must still run it before the checklist item is called verified |

## Report a problem

If something on a Lateen site is hard to use, open an issue in the [repository](https://github.com/velella-sh/lateen/issues).
