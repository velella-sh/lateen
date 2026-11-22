// A 0.2.2 site must keep the pages it had when it upgrades. `fixtures/upgrade-0.2.2-expected` is
// the HTML the v0.2.2 tag wrote for `fixtures/upgrade-0.2.2`; this test builds that site with this
// checkout and compares the documents.
//
// Asset file hashes are the only difference ignored everywhere; code blocks are compared by text
// because the highlighter's token spans depend on the engine's grammar version. Every other intended
// difference is listed with its reason, and the test fails on a difference the list does not name.
// The stored output is evidence: do not regenerate it to make this test pass.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { build, root } from "./integration-helpers.ts";

const FIXTURE = "upgrade-0.2.2";
const EXPECTED = join(root, "fixtures", `${FIXTURE}-expected`);

/** A difference this release makes on purpose, removed from both documents before comparing. */
const INTENDED = [
  { selector: ".doc-description", reason: "Sailcloth displays the page's authored description under its title." },
  { selector: ".doc-actions", reason: "0.2.3 adds the page actions, copy-Markdown and agent menu to every doc layout." },
  { selector: ".doc-tools", reason: "Documentation moves Source mode into a Page tools disclosure." },
  { selector: ".source-mode-switch", reason: "Source mode is new in 0.2.3." },
  { selector: "template[data-block-actions]", reason: "The per-block edit button was removed in 0.2.3." },
  {
    selector: "pre:has(> code[data-placeholders])",
    reason: "The code highlighter now keeps and highlights Mizzen fences with variable placeholders, which 0.2.2 omitted in this fixture.",
  },
  { selector: "pre:not(.code)", reason: "A plain scrolling code block is keyboard focusable in 0.2.3." },
  { selector: ".ask-agent", reason: "The ask-your-agent panel is new in 0.2.3." },
  { selector: ".steps", reason: "Steps number each item and keep a progress state in 0.2.3." },
  { selector: ".output-block", reason: "Output blocks share the code highlighter's markup in 0.2.3." },
  { selector: ".terminal", reason: "Terminal bodies share the code block markup in 0.2.3." },
  { selector: ".tested-chip", reason: "0.2.3 links the tested chip to the page's trust panel." },
  { selector: ".shortcuts-open,.shortcuts", reason: "The shortcuts dialog and character shortcuts were removed." },
  { selector: "script", reason: "The theme script set grows with the new islands and their data." },
  { selector: "header", reason: "0.2.3 cuts every layout over to the sailcloth site-header chrome." },
  { selector: ".progress", reason: "The sailcloth shell adds a reading progress bar above the header." },
  { selector: "footer", reason: "The sailcloth shell footer replaces the previous site-footer chrome." },
  {
    selector: 'link[rel="preload"][as="font"]',
    reason: "0.2.3 ships Manrope and JetBrains Mono instead of Geist and Geist Mono.",
  },
  {
    selector: ".callout-icon",
    reason: "0.2.3 draws callout icons with Lucide instead of the previous hand SVG paths.",
  },
  {
    selector: ".callout-kind",
    reason: "A callout with an author title also shows the kind name, matching the mockup eyebrow.",
  },
  {
    selector: 'template[data-code-copy]',
    reason: "The code-copy template carries its Lucide icons for the browser island.",
  },
  {
    selector: [
      ".trust-panel-icon",
      ".status-banner-icon",
      ".tested-chip-icon",
      ".version-diff-icon",
      ".drift-banner-icon",
      ".announcement-icon",
      ".changelog-entry-anchor-icon",
      ".changelog-entry-category-icon",
      ".file-tree-icon",
      ".heading-anchor",
      ".code-title-icon",
      ".status-icon",
      ".stale-notice-icon",
      ".add-to-calendar-icon",
      ".dated-list-icon",
      ".list-feed-icon",
      ".feature-grid-icon",
      ".trap-icon",
      ".pager-arrow",
      ".pagination-arrow",
      ".breadcrumb-sep",
      ".page-agent-menu-chevron",
    ].join(","),
    reason: "The remaining theme icons use the shared Lucide set instead of hand-written SVG paths.",
  },
  {
    selector: ".search-trigger",
    reason: "The sailcloth search control uses its visible label as the accessible name (no separate aria-label).",
  },
  {
    selector: ".search-close",
    reason: "0.3.0 shows the Esc key on the search close button and names it in the label.",
  },
  {
    selector: ".page-end",
    reason: "0.3.0 ends a doc page with one quiet row: the edit link and Back to top.",
  },
  {
    selector: ".search-clear",
    reason: "0.2.3 adds a clear control to the search field.",
  },
  {
    selector: ".search-retry",
    reason: "0.2.3 can retry a failed search index load.",
  },
  {
    selector: ".search-foot",
    reason: "0.2.3 links the dialog's phrase to the all-results page.",
  },
  {
    selector: ".mobile-selectors",
    reason: "0.2.3 puts the project, language, and version choices at the top of the mobile menu.",
  },
  {
    selector: ".drawer-header > span, .drawer-close > :is(svg, span)",
    reason: "The mobile menu shows its existing dialog name in the header and uses a Lucide icon for the close button.",
  },
  {
    selector: ".toc-fold",
    reason: "0.2.3 exposes the local section list at the start of an article on mobile.",
  },
  {
    selector: ".back-to-top",
    reason: "0.2.3 adds a back-to-top link to the page footer.",
  },
  {
    selector: ".api-example-code",
    reason: "API example code blocks are keyboard-focusable (tabindex=0) for the a11y target-size gate.",
  },
  {
    selector: 'link[rel="stylesheet"][href*="/assets/theme/page-"]',
    reason: "Sailcloth ships one theme CSS bundle; the separate page-*.css sheet from lateen-legacy is gone.",
  },
] as const;

/** Every HTML file a build wrote, as paths relative to its output folder. */
function pages(dir: string): string[] {
  const found: string[] = [];
  const walk = (path: string): void => {
    for (const entry of readdirSync(join(dir, path), { withFileTypes: true })) {
      const next = join(path, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".html")) found.push(next);
    }
  };
  walk(".");
  return found.sort();
}

/** The document with asset hashes and highlighter token spans removed, and every intended difference taken out. */
function normalize(text: string): { head: string; body: string } {
  const unhased = text
    // `base-d4840993c99ad705.css` and `geist-…-de174d9fdfca3f7d.woff2`.
    .replace(/-[0-9a-f]{16}\.(css|js|woff2)/g, "-HASH.$1")
    // 0.2.2 leaked a `div` where the kbd directive should be; 0.2.3 renders the key. This is the
    // one difference that is a fix in place, so it is reduced to its text on both sides.
    .replace(/Press (?:<div>|<kbd class="kbd">)Ctrl\+K(?:<\/div>|<\/kbd>) to search/g, "Press Ctrl+K to search");
  const dom = new JSDOM(unhased);
  const document = dom.window.document;
  for (const difference of INTENDED) {
    for (const element of [...document.querySelectorAll(difference.selector)]) element.remove();
  }
  // The shared article header places the breadcrumb and page tools together.
  for (const element of [...document.querySelectorAll(".doc-context")]) element.replaceWith(...element.childNodes);
  // The document metadata group changes only the wrapper, not the trust, freshness, or reading-time content.
  for (const element of [...document.querySelectorAll(".doc-meta")]) element.replaceWith(...element.childNodes);
  // The drawer header keeps the same close button and navigation links.
  for (const element of [...document.querySelectorAll(".drawer-header")]) element.replaceWith(...element.childNodes);
  for (const element of [...document.querySelectorAll(".drawer-close")]) element.classList.remove("iconbtn");
  // 0.2.3 renames the search field's class; the field itself is unchanged.
  for (const element of [...document.querySelectorAll(".search-field")]) {
    element.classList.replace("search-field", "search-form");
  }
  // Search adds a field icon and uses an icon close button while keeping the same controls and names.
  for (const element of [...document.querySelectorAll(".search-form > svg")]) element.remove();
  for (const element of [...document.querySelectorAll(".search-label")]) element.classList.remove("sr-only");
  for (const element of [...document.querySelectorAll(".search-close")]) {
    element.classList.remove("iconbtn");
    const icon = element.querySelector("svg");
    if (icon === null) continue;
    const glyph = document.createElement("span");
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = "×";
    icon.replaceWith(glyph);
  }
  // 0.2.3 isolates LTR data with `bdi`; the element's text and attributes are unchanged.
  for (const element of [...document.querySelectorAll("bdi")]) {
    const span = document.createElement("span");
    for (const attribute of element.attributes) span.setAttribute(attribute.name, attribute.value);
    span.append(...element.childNodes);
    element.replaceWith(span);
  }
  // 0.2.3 gives each code tab a stable fragment hook; the visible tab markup is unchanged.
  for (const element of [...document.querySelectorAll("[data-tab-fragment]")]) {
    element.removeAttribute("data-tab-fragment");
  }
  // The search field gains its own direction so a mixed-script query reads correctly.
  for (const element of [...document.querySelectorAll('.search-input[dir="auto"]')]) element.removeAttribute("dir");
  // The diagram wrapper gains its drawn width as a custom property, consumed only by the shared
  // stylesheet; the SVG, the source disclosure, and the record are unchanged.
  for (const element of [...document.querySelectorAll(".mermaid-diagram[style]")]) element.removeAttribute("style");
  // The trust panel gained an id so the tested chip can link to it.
  for (const element of [...document.querySelectorAll("details.trust-panel#trust-panel")]) element.removeAttribute("id");
  // Trust now reads dates from inline reviews and a build digest from the published report.
  // The old fixture supplies the retired build/date fields and an associated context pack.
  for (const panel of document.querySelectorAll(".trust-panel")) {
    if (panel.hasAttribute("data-trust-generated")) {
      panel.removeAttribute("data-trust-build");
      panel.removeAttribute("data-trust-generated");
      panel.querySelector('.trust-panel-action[href*="build=build-42"]')?.remove();
    }
    panel.removeAttribute("data-trust-reviewed");
    for (const row of panel.querySelectorAll(".trust-panel-generated,.trust-panel-reviewed")) {
      row.previousElementSibling?.remove();
      row.remove();
    }
  }
  // Dates use Mizzen's calendar and long-date format, retaining their machine-readable values.
  for (const time of document.querySelectorAll(".trust-panel time, .last-updated time")) {
    const datetime = time.getAttribute("datetime");
    if (datetime === null) continue;
    time.textContent = datetime;
    for (const attribute of ["title", "aria-label"]) {
      if (time.hasAttribute(attribute)) time.setAttribute(attribute, datetime);
    }
  }
  // 0.2.3 gives the endpoint method the shared version-badge style and a space before the path;
  // the method text, its method class, and the path are unchanged.
  for (const element of [...document.querySelectorAll(".endpoint-line > .endpoint-method")]) element.classList.remove("version-badge");
  for (const line of [...document.querySelectorAll(".endpoint-line")]) {
    for (const node of [...line.childNodes]) {
      if (node.nodeType === 3 && (node.textContent ?? "").trim() === "") node.remove();
    }
  }
  // The Sailcloth shell adds style-only class hooks to the existing grid and recovery content.
  for (const element of [...document.querySelectorAll(".layout")]) element.classList.remove("doc-layout");
  for (const element of [...document.querySelectorAll(".not-found")]) element.classList.remove("lonely");
  for (const element of [...document.querySelectorAll(".not-found-code")]) element.classList.remove("code-mark");
  for (const element of [...document.querySelectorAll(".not-found > .lead")]) element.classList.remove("lead");
  for (const element of [...document.querySelectorAll("[data-search-ask-heading]")]) {
    for (const name of ["data-search-ask-heading", "data-search-ask-label", "data-search-ask-hint"]) {
      element.removeAttribute(name);
    }
  }
  // A failed index load gained its own messages and a retry control, both removed as intended differences.
  for (const element of [...document.querySelectorAll("[data-search]")]) {
    for (const name of ["data-search-ready", "data-search-retry-failed"]) element.removeAttribute(name);
  }
  // A fence's token spans are the highlighter's presentation of the same text, and the engine's
  // grammar version can change them. Keep the block, its attributes, and its text; drop the spans.
  for (const block of [...document.querySelectorAll("pre.code")]) block.textContent = block.textContent;
  return { head: document.head.innerHTML, body: document.body.innerHTML };
}

/** The first place two strings differ, with enough context for the failure message. */
function firstDifference(expected: string, actual: string): string {
  let index = 0;
  while (index < expected.length && expected[index] === actual[index]) index += 1;
  const window = (text: string): string => JSON.stringify(text.slice(Math.max(0, index - 60), index + 200));
  return `at ${index}\n  stored 0.2.2: ${window(expected)}\n  this build:   ${window(actual)}`;
}

test("a 0.2.2 site renders the same pages on this version", () => {
  const site = build(FIXTURE);
  const expected = pages(EXPECTED);
  assert.deepEqual(pages(site.out), expected, "the 0.2.3 build writes the 0.2.2 page set");

  for (const page of expected) {
    const stored = normalize(readFileSync(join(EXPECTED, page), "utf8"));
    const current = normalize(site.html(`/${page}`));
    assert.equal(current.head, stored.head, `${page} head\n${firstDifference(stored.head, current.head)}`);
    assert.equal(current.body, stored.body, `${page} body\n${firstDifference(stored.body, current.body)}`);
  }
});

test("every intended difference names a reason", () => {
  for (const difference of INTENDED) {
    assert.ok(difference.reason.trim() !== "", `${difference.selector} explains why the page changed`);
    assert.ok(difference.selector.trim() !== "");
  }
  assert.ok(INTENDED.length > 0, "the reviewed difference list is not empty");
});
