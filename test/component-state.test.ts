import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import state, { STATE_KINDS, actionList, stateView, type StateDirectiveProps } from "../components/state/index.ts";
import { readUiCss } from "./ui-css-helpers.ts";

const render = (props: StateDirectiveProps, html = "") =>
  state({ props, html, page: {}, site: {} } as unknown as ComponentProps<StateDirectiveProps>);

test("an empty note is one paragraph with no heading", () => {
  const out = renderToString(stateView({ kind: "empty", description: "No posts yet." }));
  assert.equal(out, '<p class="state state-empty state-note">No posts yet.</p>');
});

test("a full block has a code mark hidden from assistive technology, a title, a description and ordered links", () => {
  const out = renderToString(
    stateView({
      kind: "not-found",
      code: "404",
      title: "Page not found",
      description: "Try the home page.",
      actions: [
        { href: "/", label: "Home" },
        { href: "/search/", label: "Search" },
      ],
    }),
  );
  assert.equal(
    out,
    '<div class="state state-not-found state-block"><p class="state-code" aria-hidden="true">404</p><h1 class="state-title">Page not found</h1><p class="state-description">Try the home page.</p><div class="state-actions"><a class="state-primary" href="/">Home</a><a class="state-secondary" href="/search/">Search</a></div></div>',
  );
});

test("only an error is a live status region", () => {
  for (const kind of STATE_KINDS) {
    const out = renderToString(stateView({ kind, description: "x" }));
    assert.equal(out.includes('role="status"'), kind === "error", kind);
  }
});

test("a block with no actions has no empty action row", () => {
  assert.doesNotMatch(renderToString(stateView({ kind: "error", title: "Failed", description: "x" })), /state-actions/);
});

test("the directive reads the body when there is no description, and renders nothing without text", () => {
  assert.match(renderToString(render({ kind: "error" }, "<p>It failed.</p>") as never), />It failed\.</);
  assert.equal(render({ kind: "error" }), null);
});

test("an unknown kind falls back to empty", () => {
  assert.match(renderToString(render({ kind: "weird", description: "x" }) as never), /state-empty/);
});

test("actions keep only labelled, root-relative or https links", () => {
  const list = JSON.stringify([
    { href: "/a/", label: "A" },
    { href: "https://x.test/", label: "B" },
    { href: "javascript:alert(1)", label: "C" },
    { href: "//evil.test/", label: "D" },
    { href: "/e/" },
  ]);
  assert.deepEqual(actionList(list), [
    { href: "/a/", label: "A" },
    { href: "https://x.test/", label: "B" },
  ]);
  assert.deepEqual(actionList("not json"), []);
  assert.deepEqual(actionList(undefined), []);
});

test("the state styles use tokens only", () => {
  const css = readUiCss();
  const block = css.slice(css.indexOf(".state-block"), css.indexOf(".state-error.state-note"));
  assert.ok(block.length > 100, "state rules exist");
  assert.doesNotMatch(block, /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
});

test("the stylesheet names every class the unit renders", () => {
  const css = readUiCss();
  for (const name of [".state-block", ".state-note", ".state-code", ".state-title", ".state-description", ".state-actions", ".state-primary", ".state-secondary"]) {
    assert.ok(css.includes(name), `no rule for ${name}`);
  }
});
