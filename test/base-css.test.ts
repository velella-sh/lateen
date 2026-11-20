// Sailcloth no longer ships styles/base.css; shared article/chrome styles live in styles/src/ui.css.
// This suite keeps the token and RTL type contracts that still apply after the lateen-legacy drop.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readUiCss } from "./ui-css-helpers.ts";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");

const ui = readUiCss();
const tokensCss = read("../styles/tokens.css");
const rtlCss = read("../styles/rtl.css");

const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

function blocks(text: string): { selector: string; body: string }[] {
  const source = stripComments(text);
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? "").trim(),
    body: match[2] ?? "",
  }));
}

const bodyOf = (source: string, selector: RegExp): string =>
  blocks(source)
    .filter((block) => selector.test(block.selector))
    .map((block) => block.body)
    .join("\n");

test("sailcloth ui.css keeps a visible focus ring", () => {
  assert.match(ui, /:focus-visible\s*\{[^}]*outline:/);
});

test("headings leave room for the sticky header", () => {
  assert.match(ui, /scroll-margin-block-start:/);
});

test("headings and tab panels share the sticky-safe scroll margin", () => {
  const shared = blocks(ui).find((block) => block.selector.includes(".code-tabs-panel[id]") && block.selector.includes("details[id]"));
  assert.ok(shared, "fragment targets share one scroll-margin rule");
  for (const target of [
    ".prose :is(h1, h2, h3, h4, h5, h6)[id]",
    ".doc-body :is(h1, h2, h3, h4, h5, h6)[id]",
    ".code-tabs-panel[id]",
    ".os-tabs-panel[id]",
    '.tabs > [role="tabpanel"][id]',
    ".embed-code-panel[id]",
    "details[id]",
  ]) {
    assert.ok(shared.selector.includes(target), target);
  }
  assert.match(shared.body, /scroll-margin-block-start:\s*6\.75rem/);
});

test("the docs shell styles use the classes the layouts render", () => {
  for (const selector of [".doc-layout main > article > h1", ".breadcrumb-list", ".toc-fold", ".block-action", ".site-header .shell-menu", ".not-found-actions", ".edit-page-link"]) {
    assert.match(ui, new RegExp(`\\${selector}(?![\\w-])`), selector);
  }
  assert.match(bodyOf(ui, /^\.block-action$/), /pointer-events:\s*none/);
  assert.match(bodyOf(ui, /^\.block-action$/), /inset-block-start:\s*-1\.75rem/);
  assert.match(ui, /\.site-header \.shell-menu\s*\{\s*display:\s*none/);
  assert.match(ui, /@media \(max-width: 48rem\)[\s\S]*?\.sidebar\s*\{[^}]*display:\s*none/);
});

test("home preview and mobile cards keep the Sailcloth surface contract", () => {
  assert.match(ui, /\.preview-code\s*\{[^}]*background:\s*var\(--card\)/s);
  assert.match(ui, /@media \(max-width: 48rem\)[\s\S]*\.home-sections,[\s\S]*grid-template-columns:\s*1fr/s);
});

test("document typography and metadata follow the Sailcloth prose contract", () => {
  assert.match(bodyOf(ui, /^\.doc-layout main > article > h1$/), /font-size:\s*clamp\(2\.125rem, 4\.2vw, 2\.625rem\)/);

  const description = bodyOf(ui, /^\.doc-description$/);
  assert.match(description, /margin:\s*0\.875rem 0 0/);
  assert.match(description, /max-inline-size:\s*40em/);
  assert.match(description, /font-size:\s*1\.125rem/);
  assert.match(description, /line-height:\s*1\.875rem/);

  const meta = bodyOf(ui, /^\.doc-meta$/);
  assert.match(meta, /display:\s*flex/);
  assert.match(meta, /flex-wrap:\s*wrap/);
  assert.match(meta, /margin-block-start:\s*0\.75rem/);
  assert.match(bodyOf(ui, /^\.doc-meta \.trust-panel$/), /margin:\s*0/);
  assert.match(bodyOf(ui, /^\.reading-time,\s*\.doc-meta \.last-updated$/), /margin:\s*0/);

  const section = bodyOf(ui, /^\.doc-body h2$/);
  assert.match(section, /font-size:\s*1\.375rem/);
  assert.match(section, /line-height:\s*1\.875rem/);
  assert.match(bodyOf(ui, /^\.doc-body p$/), /max-inline-size:\s*40em/);
  assert.match(bodyOf(ui, /^\.code-copy svg$/), /inline-size:\s*0\.875rem/);
  assert.match(bodyOf(ui, /^\.code-copy svg$/), /block-size:\s*0\.875rem/);
});

test("document tables, reference rows, code panels, and callouts stay quiet and compact", () => {
  assert.match(bodyOf(ui, /^\.breadcrumb$/), /margin:\s*0/);

  const table = bodyOf(ui, /^\.doc-body table$/);
  assert.match(table, /margin:\s*1\.125rem 0 0\.625rem/);
  assert.doesNotMatch(table, /rounded|overflow/);
  const cells = bodyOf(ui, /^\.doc-body th,\s*\.doc-body td$/);
  assert.match(cells, /padding-block:\s*0\.75rem/);
  assert.match(cells, /padding-inline:\s*0 1rem/);
  assert.match(cells, /border-bottom:\s*1px solid var\(--border\)/);
  const headers = bodyOf(ui, /^\.doc-body th$/);
  assert.doesNotMatch(headers, /bg-muted|background/);
  assert.match(headers, /color:\s*var\(--muted-foreground\)/);

  const rows = bodyOf(ui, /^\.item,\s*\.list a$/);
  assert.match(rows, /grid-template-columns:\s*minmax\(7\.5rem, 0\.4fr\) minmax\(0, 1fr\)/);
  assert.match(bodyOf(ui, /^\.code-block$/), /rounded-xl/);

  const callout = bodyOf(ui, /^\.callout$/);
  assert.match(callout, /margin:\s*1\.125rem 0/);
  assert.match(callout, /padding-block:\s*0\.875rem/);
  assert.match(callout, /padding-inline:\s*1\.125rem 1rem/);
  const calloutBody = bodyOf(ui, /^\.callout-body$/);
  assert.match(calloutBody, /font-size:\s*0\.90625rem/);
  assert.match(calloutBody, /line-height:\s*1\.4375rem/);
});

test("the color and length helpers still catch raw values", () => {
  const RAW_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|device-cmyk)\s*\(/i;
  const RAW_LENGTH = /(?:^|[^\w-])-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|ex|ch|vw|vh|vmin|vmax|pt|pc|cm|mm|in|q|fr)\b/i;
  const withoutTokens = (value: string): string => value.replace(/var\(\s*--[a-z0-9-]+\s*(?:,[^)]*)?\)/gi, " ");
  for (const value of ["#fff", "rgb(0 0 0 / 0.1)", "light-dark(#fff, #000)"]) assert.ok(RAW_COLOR.test(value), value);
  for (const value of ["var(--color-text)", "currentColor", "transparent"]) assert.ok(!RAW_COLOR.test(value), value);
  for (const value of ["16px", "1rem", "65ch"]) assert.ok(RAW_LENGTH.test(value), value);
  for (const value of ["0", "100%", "var(--space-4)"]) assert.ok(!RAW_LENGTH.test(withoutTokens(value)), value);
});

test("the new type tokens exist, and Arabic-script text takes its leading from tokens/rtl.json (#468)", () => {
  for (const token of [
    "type-tracking-display",
    "type-tracking-heading",
    "type-leading-display",
    "type-leading-snug",
    "rtl-leading-display",
    "rtl-leading-snug",
  ]) {
    assert.match(tokensCss, new RegExp(`--${token}:`), token);
  }
  const root = bodyOf(rtlCss, /^:root:lang\(fa\),\s*:root:lang\(ar\)$/);
  assert.match(root, /--type-leading-display:\s*var\(--rtl-leading-display\)/);
  assert.match(root, /--type-leading-snug:\s*var\(--rtl-leading-snug\)/);
  assert.match(root, /--type-tracking-display:\s*var\(--rtl-letter-spacing\)/);
  assert.match(root, /--type-tracking-heading:\s*var\(--rtl-letter-spacing\)/);
  for (const match of rtlCss.matchAll(/letter-spacing:\s*([^;]+);/g)) {
    assert.equal((match[1] ?? "").trim(), "var(--rtl-letter-spacing)", "Arabic-script rules never set a literal letter-spacing");
  }
  assert.match(tokensCss, /--rtl-letter-spacing:\s*normal/);
});

test("the line-length limits and page padding stay token-driven (#469)", () => {
  assert.match(tokensCss, /--type-measure-min:\s*65ch/);
  assert.match(tokensCss, /--type-measure-max:\s*80ch/);
  assert.match(tokensCss, /--space-page:\s*clamp\(/);
});

test("changelog entry styles live in sailcloth ui.css", () => {
  assert.match(ui, /\.changelog-entry\b/);
});

test("the back-to-top link keeps the 24px target size", () => {
  const rules = blocks(ui).filter((block) => block.selector.split(",").map((part) => part.trim()).includes(".back-to-top"));
  assert.ok(rules.some((rule) => /min-block-size:\s*1\.5rem/.test(rule.body) && /min-inline-size:\s*1\.5rem/.test(rule.body)), "the shared target-size rule names .back-to-top");
});
