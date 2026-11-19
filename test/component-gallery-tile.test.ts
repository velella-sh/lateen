import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderToString } from "preact-render-to-string";
import galleryCard, { COVER_CLASS, TITLE_CLASS } from "../components/gallery-card/index.ts";
import tile, { TILE_CLASS, TILE_TONES, firstLetter, toneOf } from "../components/gallery-card/tile.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const css = "" /* lateen-legacy removed: components/gallery-card/style.css */;
const names = JSON.parse(readFileSync(join(root, "tokens/names.json"), "utf8")) as Record<
  string,
  Record<string, { $value?: string; $extensions?: { lateen?: { dark?: string } } }>
>;

const render = (props: Parameters<typeof galleryCard>[0]): string =>
  renderToString(galleryCard(props) as never);

/** A `--group-key` token's value in one theme. */
function tokenValue(name: string, dark: boolean): string {
  const [group, ...key] = name.replace(/^--/, "").split("-");
  const entry = names[group ?? ""]?.[key.join("-")];
  const value = dark ? entry?.$extensions?.lateen?.dark : entry?.$value;
  assert.ok(value, `${name} is missing in ${dark ? "dark" : "light"}`);
  return value;
}

/** WCAG 2.2 relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

test("the first letter is one grapheme in Latin, Persian, and Arabic", () => {
  assert.equal(firstLetter("Alpha"), "A");
  assert.equal(firstLetter("  کتاب"), "ک");
  assert.equal(firstLetter("كتاب"), "ك");
  assert.equal(firstLetter("👩🏽‍🚀 Rocket"), "👩🏽‍🚀", "a code-unit slice would cut the emoji in half");
  assert.equal(firstLetter("   "), "");
});

test("the same id always picks the same tone", () => {
  for (const id of ["alpha", "كتاب", "record-1"]) {
    assert.equal(toneOf(id), toneOf(id));
    assert.ok(toneOf(id) >= 0 && toneOf(id) < TILE_TONES.length);
  }
});

test("a tile draws the letter with its stable tone, hidden from screen readers", () => {
  const id = "alpha";
  const out = renderToString(tile({ title: "Alpha", id }) as never);
  assert.equal(out, `<span class="${TILE_CLASS} ${TILE_CLASS}-${toneOf(id)}" aria-hidden="true">A</span>`);
  assert.equal(renderToString(tile({ title: "  ", id }) as never), "");
});

test("a card without a cover shows its tile, a card with one does not", () => {
  for (const [title, letter] of [["Alpha", "A"], ["کتاب", "ک"], ["كتاب", "ك"]] as const) {
    const id = `id-${letter}`;
    const out = render({ href: `/books/${id}/`, id, title });
    assert.doesNotMatch(out, /<img\b/);
    assert.match(out, new RegExp(`<span class="${TILE_CLASS} ${TILE_CLASS}-${toneOf(id)}" aria-hidden="true">${letter}</span>`));
    assert.match(out, new RegExp(`<span class="${TITLE_CLASS}">${title}</span>`));
  }

  const withCover = render({ href: "/books/alpha/", id: "alpha", title: "Alpha", cover: "/covers/a.jpg" });
  assert.match(withCover, new RegExp(`<img class="${COVER_CLASS}"`));
  assert.doesNotMatch(withCover, new RegExp(TILE_CLASS));
});

test("a tile's class falls back to the href when no id is given, so it stays stable", () => {
  const props = { href: "/books/alpha/", title: "Alpha" } as const;
  assert.equal(render(props), render(props));
  assert.match(render(props), new RegExp(`${TILE_CLASS}-${toneOf(props.href)}`));
});

