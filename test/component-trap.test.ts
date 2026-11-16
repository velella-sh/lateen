import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import trap, { directive, OPTIONS } from "../components/trap/index.ts";

const render = (lang: string, props: { title?: string } = {}, html = "<p>Body</p>"): string =>
  renderToString(trap({ props, html, page: { lang } } as never) as never);

test("the directive is trap and reads only title", () => {
  assert.equal(directive, "trap");
  assert.deepEqual([...OPTIONS], ["title"]);
});

test("default title is the translated Watch out, in three languages", () => {
  assert.match(render("en"), />Watch out</);
  assert.match(render("fa"), />مراقب باشید</);
  assert.match(render("ar"), />احذر</);
});

test("the title can be overridden and the body is kept", () => {
  const html = render("en", { title: "Careful" });
  assert.match(html, />Careful</);
  assert.doesNotMatch(html, /Watch out/);
  assert.match(html, /<p>Body<\/p>/);
});

test("is its own component: note role, labelled by its title, own icon", () => {
  const html = render("en");
  assert.match(html, /class="trap"/);
  assert.doesNotMatch(html, /callout/);
  assert.match(html, /role="note" aria-labelledby="(trap-title-\d+)"/);
  assert.match(html, /aria-hidden="true"/);
});
