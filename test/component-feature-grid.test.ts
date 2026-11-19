import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import featureGrid, { columnsOf, DEFAULT_COLUMNS } from "../components/feature-grid/index.ts";
import { iconByName } from "../src/icon.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const css = "" /* lateen-legacy removed: components/feature-grid/style.css */;
const names = JSON.parse(readFileSync(join(root, "tokens/names.json"), "utf8")) as Record<string, Record<string, unknown>>;

type VNode = { type: unknown; props: { children?: unknown; [key: string]: unknown } };
const isVNode = (n: unknown): n is VNode => typeof n === "object" && n !== null && "type" in n && "props" in n;
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function html(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return esc(String(node));
  if (Array.isArray(node)) return node.map(html).join("");
  if (!isVNode(node)) return "";
  const { children, dangerouslySetInnerHTML, ...attrs } = node.props as VNode["props"] & {
    dangerouslySetInnerHTML?: { __html: string };
  };
  const attrText = Object.entries(attrs).map(([k, v]) => ` ${k}="${esc(String(v))}"`).join("");
  const inner = dangerouslySetInnerHTML ? dangerouslySetInnerHTML.__html : html(children);
  return typeof node.type === "string" ? `<${node.type}${attrText}>${inner}</${node.type}>` : inner;
}

const features = [
  { title: "Fast", description: "Builds in seconds.", icon: "check", url: "/fast/" },
  { title: "Plain", description: "No script needed." },
  { title: "Open", url: "https://example.com/" },
];

test("renders icon, title, text and optional link per item", () => {
  const out = html(featureGrid({ features }));
  assert.match(out, /^<ul class="feature-grid" data-columns="3">/);
  assert.equal((out.match(/<li /g) ?? []).length, 3);
  assert.match(out, /<a class="feature-grid-card" href="\/fast\/"><span class="feature-grid-icon" aria-hidden="true"><svg/);
  assert.match(out, /<span class="feature-grid-title">Plain<\/span><span class="feature-grid-text">No script needed\.<\/span>/);
  assert.equal((out.match(/<a /g) ?? []).length, 2);
});

test("a linked card is one tab stop: one anchor holds the whole card, with no nested control", () => {
  const out = html(featureGrid({ features: [{ title: "T", description: "D", icon: "tip", url: "/t/" }] }));
  assert.equal((out.match(/<a /g) ?? []).length, 1);
  assert.match(out, /<li [^>]*><a [^>]*href="\/t\/">.*<\/a><\/li>/);
  assert.doesNotMatch(out, /tabindex|<button|<input/);
  assert.match(out, /<span class="feature-grid-title">T<\/span>/);
  assert.match(out, /<span class="feature-grid-text">D<\/span><\/a>/);
});

test("an unsafe or missing link leaves a plain card", () => {
  const out = html(featureGrid({ features: [{ title: "X", url: "javascript:alert(1)" }, { title: "Y", url: "//evil" }] }));
  assert.doesNotMatch(out, /<a /);
  assert.doesNotMatch(out, /javascript/);
});

test("entries without a title are dropped; nothing left renders nothing", () => {
  assert.equal(featureGrid({ features: [{ description: "x" }, null, "s", { title: "  " }] }), null);
  assert.equal(featureGrid({}), null);
  assert.equal(featureGrid({ features: [] }), null);
  const out = html(featureGrid({ features: [{ description: "x" }, { title: "Keep" }] }));
  assert.equal((out.match(/<li /g) ?? []).length, 1);
});

test("the icon is decoration only: hidden, by known name, and the title stays the name", () => {
  assert.equal(iconByName("nope"), undefined);
  assert.equal(iconByName("constructor"), undefined);
  assert.equal(iconByName(3), undefined);
  assert.ok(iconByName("tip"));
  const out = html(featureGrid({ features: [{ title: "T", icon: "<script>" }] }));
  assert.doesNotMatch(out, /feature-grid-icon/);
  assert.doesNotMatch(out, /<script/);
  assert.match(html(featureGrid({ features: [{ title: "T", icon: "tip" }] })), /feature-grid-icon" aria-hidden="true"/);
});

test("text is escaped and right-to-left text is kept", () => {
  const out = html(featureGrid({ features: [{ title: "<b>سریع</b>", description: "متن فارسی & عربي", url: "/fa/" }] }));
  assert.match(out, /&lt;b&gt;سریع&lt;\/b&gt;/);
  assert.match(out, /متن فارسی &amp; عربي/);
});

