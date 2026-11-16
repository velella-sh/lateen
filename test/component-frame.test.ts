import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import cliDemo from "../components/cli-demo/index.ts";
import figure from "../components/figure/index.ts";
import frame, { directive } from "../components/frame/index.ts";
import terminal from "../components/terminal/index.ts";

function input(props: Record<string, string>, html: string, lang = "en"): ComponentProps {
  return { props, html, page: { lang, source: { file: "site/page.md", line: 3 } }, site: {} } as unknown as ComponentProps;
}

function draw(component: unknown, props: Record<string, string>, html: string, lang = "en"): string {
  return renderToString((component as (i: ComponentProps) => never)(input(props, html, lang)));
}

function wrap(inner: string, props: Record<string, string> = {}, lang = "en"): string {
  return draw(frame, props, inner, lang);
}

const css = readFileSync(new URL("../components/frame/style.css", import.meta.url), "utf8");

test("the directive is frame", () => {
  assert.equal(directive, "frame");
});

test("a title bar, the content and a caption surround the content", () => {
  const out = wrap("<p>hi</p>", { title: "Demo", caption: "A caption" });
  assert.match(out, /^<figure class="frame"/);
  assert.match(out, /<div class="frame-bar"><span class="frame-title">Demo<\/span><\/div>/);
  assert.match(out, /<div class="frame-body"[^>]*><p>hi<\/p><\/div>/);
  assert.match(out, /<figcaption class="frame-caption">A caption<\/figcaption>/);
});

test("without a title the bar has no text, and without a caption there is no figcaption", () => {
  const out = wrap("<p>hi</p>");
  assert.doesNotMatch(out, /frame-title/);
  assert.doesNotMatch(out, /figcaption/);
  assert.doesNotMatch(out, /aria-label/);
});

test("a frame with no content renders nothing", () => {
  assert.equal(draw(frame, { title: "Demo" }, "  \n"), "");
});

test("title and caption are escaped", () => {
  const out = wrap("<p>x</p>", { title: "<b>t</b>", caption: "<i>c</i>" });
  assert.match(out, /&lt;b>t&lt;\/b>/);
  assert.match(out, /&lt;i>c&lt;\/i>/);
  assert.doesNotMatch(out, /<b>t/);
});

test("wraps a terminal without drawing a second one", () => {
  const inner = draw(terminal, {}, "<p>$ npm ci\nadded 2 packages</p>");
  assert.match(inner, /class="terminal/);
  const out = wrap(inner, { title: "Install" });
  assert.ok(out.includes(inner), "the terminal markup is kept as it is");
  assert.equal(out.match(/class="terminal"/g)?.length, 1);
});

test("wraps a cli-demo as it is", () => {
  const inner = draw(cliDemo, {}, "<p>$ npm run build\ndone</p>");
  assert.match(inner, /data-cli-demo/);
  const out = wrap(inner, { title: "Build" });
  assert.ok(out.includes(inner));
  assert.equal(out.match(/data-cli-demo(?=[ >])/g)?.length, 1);
});

test("wraps a figure and its caption stays the figure's own", () => {
  const inner = draw(figure, { src: "/a.png", alt: "A", caption: "Inner" }, "");
  const out = wrap(inner, { caption: "Outer" });
  assert.ok(out.includes(inner));
  assert.match(out, /Inner/);
  assert.match(out, /<figcaption class="frame-caption">Outer/);
});

test("wraps a code block", () => {
  const inner = '<pre class="code"><code>const a = 1;</code></pre>';
  const out = wrap(inner, { title: "a.ts" });
  assert.ok(out.includes(inner));
});

test("the body scrolls and can be focused with the keyboard, named by the title", () => {
  const out = wrap("<pre>long</pre>", { title: "Demo" });
  assert.match(out, /class="frame-body" tabindex="0" role="group" aria-label="Demo"/);
  assert.match(css, /\.frame-body\s*\{[^}]*overflow:\s*auto/);
  assert.match(css, /\.frame-body\s*\{[^}]*min-inline-size:\s*0/);
  assert.match(css, /\.frame\s*\{[^}]*max-inline-size:\s*100%/);
});

test("on a right-to-left page terminal content stays left to right and the frame follows the page", () => {
  for (const lang of ["fa", "ar"]) {
    const out = wrap(draw(terminal, {}, "<p>$ ls</p>", lang), { title: "عنوان" }, lang);
    assert.match(out, /class="terminal/);
    assert.doesNotMatch(out, /dir="/, "the frame does not force a direction");
  }
  assert.match(css, /\.frame-body \.terminal,[^{]*\.frame-body pre[^{]*\{[^}]*direction:\s*ltr/);
  assert.doesNotMatch(css, /\.frame\s*\{[^}]*direction/);
});

test("the stylesheet uses logical properties, tokens, and keeps borders in print", () => {
  assert.doesNotMatch(css, /\b(margin|padding)-(left|right)\b|\b(left|right):/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.match(css, /@media print[\s\S]*\.frame-body\s*\{[^}]*overflow:\s*visible/);
  assert.doesNotMatch(css.slice(css.indexOf("@media print")), /border:\s*0|border:\s*none/);
});
