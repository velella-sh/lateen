import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps, Page } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import pageTool, {
  FALLBACK_CLASS,
  LINK_CLASS,
  SLOT_CLASS,
  TITLE_CLASS,
  TITLE_ID,
  TOOL_CLASS,
  toolHref,
  type PageToolProps,
} from "../components/page-tool/index.ts";

function pageOf(lang = "en"): Page {
  return { lang } as unknown as Page;
}

function componentProps(props: PageToolProps, lang = "en"): ComponentProps<PageToolProps> {
  return {
    props,
    html: "",
    page: pageOf(lang),
    site: {} as ComponentProps["site"],
  } as ComponentProps<PageToolProps>;
}

function markup(props: PageToolProps, lang = "en"): string {
  const node = pageTool(componentProps(props, lang));
  return node === null ? "" : renderToString(node as never);
}

/** The attributes of the first element with `tag`, as text; fails when the element is absent. */
function tagOf(out: string, tag: string): string {
  const found = new RegExp(`<${tag}\\b([^>]*)>`).exec(out);
  assert.ok(found, `expected a <${tag}> in ${out}`);
  return found[1]!;
}

test("the tool asset keeps the site base at the root and under a nested path", () => {
  assert.equal(toolHref("", "tool/sample.js"), "/tool/sample.js");
  assert.equal(toolHref("/lateen", "tool/sample.js"), "/lateen/tool/sample.js");
  assert.equal(toolHref("/lateen", "/tool/sample.js"), "/lateen/tool/sample.js");
  assert.equal(toolHref("/lateen", "  tool/sample.js  "), "/lateen/tool/sample.js");
});

test("a missing or unsafe tool names no URL", () => {
  for (const value of [undefined, null, 42, "", "   ", "/", "javascript:alert(1)", "data:text/html,x"]) {
    assert.equal(toolHref("", value), undefined, `expected no URL for ${String(value)}`);
  }
});

test("a configured tool renders a named slot, its module, and the no-JavaScript fallback", () => {
  const out = markup({ base: "/lateen", tool: "tool/sample.js" });
  const section = tagOf(out, "section");
  assert.match(section, new RegExp(`class="${TOOL_CLASS}"`));
  assert.match(section, new RegExp(`aria-labelledby="${TITLE_ID}"`));
  assert.match(out, new RegExp(`<h2 class="${TITLE_CLASS}" id="${TITLE_ID}">Interactive tool</h2>`));
  assert.match(out, new RegExp(`<div class="${SLOT_CLASS}" data-page-tool="true">`));
  assert.match(out, /This tool needs JavaScript\. Your input stays in your browser\./);
  assert.match(out, new RegExp(`<a class="${LINK_CLASS}" href="/lateen/tool/sample\\.js">Open the tool file</a>`));
  assert.match(out, /<script type="module" src="\/lateen\/tool\/sample\.js"><\/script>/);
  assert.doesNotMatch(out, /hidden/, "the fallback must stay visible without JavaScript");
});

test("a page without a tool renders nothing", () => {
  assert.equal(pageTool(componentProps({ base: "/lateen" })), null);
  assert.equal(pageTool(componentProps({ base: "/lateen", tool: "" })), null);
});

test("the tool path is escaped in the markup", () => {
  const out = markup({ base: "", tool: 'tool/a"b<c.js' });
  assert.match(out, /href="\/tool\/a&quot;b&lt;c\.js"/);
  assert.match(out, /src="\/tool\/a&quot;b&lt;c\.js"/);
  assert.doesNotMatch(out, /"b<c\.js/);
});

test("the fallback reads in the page's language and direction-neutral text", () => {
  const out = markup({ base: "", tool: "tool/sample.js" }, "fa");
  assert.match(out, /ابزار تعاملی/);
  assert.match(out, /باز کردن فایل ابزار/);
  assert.doesNotMatch(out, /dir="ltr"/);
});
