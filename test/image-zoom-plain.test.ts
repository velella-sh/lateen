import assert from "node:assert/strict";
import { test } from "node:test";
import { articleHtml, imageZoom } from "../src/article-html.ts";
import { resolveImageOptions } from "../src/options.ts";

const on = imageZoom({ images: { zoom: "auto" } });
const large = '<p><img src="/big.png" alt="Big" width="1200" height="600"></p>';

test("with zoom auto, a large plain image gets the shared panel", () => {
  const html = articleHtml(large, "en", on);
  assert.match(html, /<div class="figure-zoomable"><button type="button" class="figure-zoom" popovertarget="image-zoom-1" aria-label="Enlarge image: Big"><img src="\/big\.png" alt="Big" width="1200" height="600"><\/button>/);
  assert.match(html, /<div id="image-zoom-1" popover="auto" class="figure-zoom-panel" role="dialog" aria-label="Big">/);
  assert.match(html, /class="figure-zoom-full" href="\/big\.png"/);
});

test("a small image, one without a width, a linked one, a figure image and an opt-out stay as they are", () => {
  for (const source of [
    '<p><img src="/s.png" alt="s" width="300"></p>',
    '<p><img src="/n.png" alt="n"></p>',
    '<p><a href="/x"><img src="/l.png" alt="l" width="1200"></a></p>',
    '<figure class="figure"><img src="/f.png" alt="f" width="1200"></figure>',
    '<p><img src="/o.png" alt="o" width="1200" zoom="false"></p>',
  ]) {
    assert.equal(articleHtml(source, "en", on), articleHtml(source), source);
    assert.doesNotMatch(articleHtml(source, "en", on), /figure-zoomable/);
  }
});

test("with the option off or missing, the page renders as before", () => {
  assert.equal(imageZoom({}), undefined);
  assert.equal(imageZoom({ images: { zoom: "off" } }), undefined);
  assert.equal(articleHtml(large, "en", imageZoom(undefined)), articleHtml(large));
});

test("several large images get different panel ids, and a prefix keeps pieces apart", () => {
  const two = `${large}${large}`;
  const html = articleHtml(two, "en", imageZoom({ images: { zoom: "auto" } }, "p-"));
  assert.match(html, /id="p-1"/);
  assert.match(html, /id="p-2"/);
});

test("an unknown images.zoom value stops the build with its path", () => {
  assert.deepEqual(resolveImageOptions({ images: { zoom: "auto" } }), { zoom: "auto" });
  assert.throws(() => resolveImageOptions({ images: { zoom: "always" } }), /theme\.options\.images\.zoom must be "off" or "auto"/);
  assert.throws(() => resolveImageOptions({ images: "auto" }), /theme\.options\.images must be an object/);
});
