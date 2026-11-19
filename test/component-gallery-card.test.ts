import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderToString } from "preact-render-to-string";
import galleryCard, {
  BODY_CLASS,
  COVER_CLASS,
  GALLERY_CARD_CLASS,
  STATUS_CLASS,
  SUMMARY_CLASS,
  TITLE_CLASS,
} from "../components/gallery-card/index.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const namesPath = join(root, "tokens/names.json");

const render = (props: Parameters<typeof galleryCard>[0]): string =>
  renderToString(galleryCard(props) as never);

test("default export is the card component", () => {
  assert.equal(typeof galleryCard, "function");
});

test("a card is one link with a cover, a title, a summary, and a status", () => {
  const out = render({
    href: "/books/alpha/",
    title: "Alpha",
    cover: "/covers/alpha.jpg",
    summary: "The first book.",
    status: "Available",
  });

  assert.equal(
    out,
    `<a class="${GALLERY_CARD_CLASS}" href="/books/alpha/">` +
      `<img class="${COVER_CLASS}" src="/covers/alpha.jpg" alt loading="eager"/>` +
      `<span class="${BODY_CLASS}">` +
      `<span class="${TITLE_CLASS}">Alpha</span>` +
      `<span class="${SUMMARY_CLASS}">The first book.</span>` +
      `<span class="${STATUS_CLASS}">Available</span>` +
      `</span>` +
      `</a>`,
  );
});

test("a card without a summary keeps its other parts", () => {
  const out = render({ href: "/books/beta/", title: "Beta", cover: "/covers/beta.jpg", status: "Draft" });
  assert.doesNotMatch(out, new RegExp(SUMMARY_CLASS));
  assert.match(out, new RegExp(`<span class="${TITLE_CLASS}">Beta</span>`));
  assert.match(out, new RegExp(`<img class="${COVER_CLASS}" src="/covers/beta.jpg" alt loading="eager"/>`));
  assert.match(out, new RegExp(`<span class="${STATUS_CLASS}">Draft</span>`));
});

test("the cover is decorative: empty alt, no duplicate name for screen readers", () => {
  const out = render({ href: "/x/", title: "Named by the title", cover: "/cover.png" });
  assert.match(out, new RegExp(`<img class="${COVER_CLASS}" src="/cover.png" alt loading="eager"/>`));
  assert.doesNotMatch(out, /alt="[^"]+"/);
});

test("the whole card is exactly one link, with no nested links or controls", () => {
  const out = render({ href: "/x/", title: "One", cover: "/c.png", summary: "S", status: "T" });
  assert.equal((out.match(/<a\b/g) ?? []).length, 1);
  assert.equal((out.match(/<\/a>/g) ?? []).length, 1);
  assert.doesNotMatch(out, /<a\b[^>]*>(?:(?!<\/a>).)*<a\b/s);
  assert.doesNotMatch(out, /<(?:button|input|select|textarea)\b/);
});

test("unsafe hrefs and blank titles render static content, never an unnamed link", () => {
  for (const href of ["javascript:alert(1)", "//evil.example", "", "  ", "/spaced path"]) {
    const out = render({ href, title: "Static", summary: "Still readable." });
    assert.doesNotMatch(out, /<a\b|href=/, `href ${JSON.stringify(href)} must not render a link`);
    assert.match(out, new RegExp(`^<div class="${GALLERY_CARD_CLASS}">`));
    assert.match(out, /Still readable\./);
  }
  for (const title of ["", "   ", "\n\t"]) {
    const out = render({ href: "/ok/", title });
    assert.doesNotMatch(out, /<a\b/);
    assert.match(out, new RegExp(`^<div class="${GALLERY_CARD_CLASS}">`));
  }
});

test("text is escaped, never parsed as markup", () => {
  const out = render({ href: "/x/", title: "<b>Bold</b>", summary: "a & b", status: "<i>new</i>" });
  assert.match(out, /&lt;b>Bold&lt;\/b>/);
  assert.match(out, /a &amp; b/);
  assert.match(out, /&lt;i>new&lt;\/i>/);
});

