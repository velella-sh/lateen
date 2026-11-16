import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import checkList, { checksOf } from "../components/check-list/index.ts";

const HTML =
  "<ul><li><code>node --version</code><br>Prints <code>v24</code> or newer.</li><li><code>npm test</code></li><li>No command here</li></ul>";
const render = (lang = "en", html = HTML): string => renderToString(checkList({ props: {}, html, page: { lang } } as never) as never);

test("renders each command with its expected result below it", () => {
  const html = render();
  assert.equal(html.match(/class="check-item"/g)?.length, 2);
  assert.match(html, /<code>node --version<\/code>/);
  assert.ok(html.indexOf("check-code") < html.indexOf("check-expected-body"));
  assert.match(html, /Prints <code>v24<\/code> or newer\./);
});

test("the expected result is labelled as text; a command without one says so", () => {
  const html = render();
  assert.match(html, /<span class="check-expected-label">Expected result<\/span>/);
  assert.match(html, /data-expected="none"/);
  assert.match(html, /No output expected/);
  assert.match(render("fa"), /نتیجهٔ مورد انتظار/);
  assert.deepEqual(checksOf(HTML).map((c) => c.expected === ""), [false, true]);
});

test("each command has a copy button holding the command only, hidden until the island runs", () => {
  const html = render();
  assert.equal(html.match(/data-check-list-copy/g)?.length, 2);
  assert.match(html, /data-text="npm test"/);
  assert.match(html, /hidden/);
});

test("nothing is run and a body without commands is passed through", () => {
  assert.match(render("en", "<p>Nothing</p>"), /<p>Nothing<\/p>/);
});
