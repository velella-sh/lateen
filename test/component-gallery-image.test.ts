import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderToString } from "preact-render-to-string";
import galleryCard, { COVER_CLASS, FIRST_ROW } from "../components/gallery-card/index.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const css = "" /* lateen-legacy removed: components/gallery-card/style.css */;
const render = (props: Parameters<typeof galleryCard>[0]): string =>
  renderToString(galleryCard(props) as never);
const cover = (props: Partial<Parameters<typeof galleryCard>[0]>): string =>
  render({ href: "/x/", title: "X", cover: "/cover.png", ...props });

test("the first row loads eagerly and every card after it lazily", () => {
  assert.equal(FIRST_ROW, 4, "four cards fill the desktop grid's first row");

  for (let index = 0; index < FIRST_ROW; index += 1) {
    const out = cover({ index });
    assert.match(out, new RegExp(`<img class="${COVER_CLASS}"`));
    assert.match(out, /<img\b[^>]*loading="eager"/, `card ${index} is above the fold`);
    assert.doesNotMatch(out, /loading="lazy"/);
  }

  const later = cover({ index: FIRST_ROW });
  assert.match(later, /<img\b[^>]*loading="lazy"/);
  assert.doesNotMatch(later, /loading="eager"/);
});

test("a card with no place yet is treated as above the fold", () => {
  assert.match(cover({}), /<img\b[^>]*loading="eager"/);
});

test("the record's dimensions reserve the cover's box", () => {
  assert.match(cover({ width: 1200, height: 675 }), /<img\b[^>]*width="1200"[^>]*height="675"/);
  assert.match(cover({ width: " 640 ", height: "360" }), /<img\b[^>]*width="640"[^>]*height="360"/);
});

test("the engine's responsive candidates and sizes reach the cover", () => {
  const out = cover({ srcset: "/cover-400.png 400w, /cover-800.png 800w", sizes: "(min-width: 60rem) 22rem, 100vw" });
  assert.match(out, /srcset="\/cover-400\.png 400w, \/cover-800\.png 800w"/);
  assert.match(out, /sizes="\(min-width: 60rem\) 22rem, 100vw"/);
});

test("without responsive data, srcset and sizes are left off", () => {
  const out = cover({ srcset: "  ", sizes: "" });
  assert.doesNotMatch(out, /srcset=/);
  assert.doesNotMatch(out, /sizes=/);
});
