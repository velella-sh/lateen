import assert from "node:assert/strict";
import { test } from "node:test";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { zoomable } from "../src/zoom.ts";

const trigger = h("img", { src: "/a.png", alt: "A chart" });

test("the shared panel has a named button, a dialog panel, a full-size link and a close button", () => {
  const html = renderToString(zoomable({ id: "z1", lang: "en", alt: "A chart", trigger, full: "/a-large.png" }));
  assert.match(html, /^<div class="figure-zoomable">/);
  assert.match(html, /<button type="button" class="figure-zoom" popovertarget="z1" aria-label="Enlarge image: A chart"><img src="\/a\.png" alt="A chart"\/><\/button>/);
  assert.match(html, /<div id="z1" popover="auto" class="figure-zoom-panel" role="dialog" aria-label="A chart">/);
  assert.match(html, /<img class="figure-zoom-img" src="\/a-large\.png" alt="A chart" loading="lazy" decoding="async"\/>/);
  assert.match(html, /<a class="figure-zoom-full" href="\/a-large\.png">Open full size<\/a>/);
  assert.match(html, /popovertarget="z1" popovertargetaction="hide"/);
});

test("a decorative image gets the plain label on both the button and the panel", () => {
  const html = renderToString(zoomable({ id: "z2", lang: "en", alt: "", trigger, full: "/a.png" }));
  assert.match(html, /aria-label="Enlarge image"><img/);
  assert.match(html, /role="dialog" aria-label="Enlarge image"/);
});
