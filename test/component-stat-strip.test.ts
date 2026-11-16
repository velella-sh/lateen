import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import statStrip, { statsOf, type StatStripProps } from "../components/stat-strip/index.ts";

function render(stats: unknown, props: StatStripProps = {}): string {
  const input = { props, html: "", page: { lang: "en", frontMatter: { stats } } } as unknown as ComponentProps<StatStripProps>;
  const out = statStrip(input);
  return out === null ? "" : renderToString(out as never);
}

const fig = (n: number) => ({ value: String(n * 10), label: `Label ${n}` });
const count = (html: string) => (html.match(/<li /g) ?? []).length;

test("renders three figures with value and label as text", () => {
  const out = render([fig(1), fig(2), fig(3)]);
  assert.equal(count(out), 3);
  assert.match(out, /<span class="stat-value">10<\/span><span class="stat-label">Label 1<\/span>/);
  assert.match(out, /<ul class="stat-strip"/);
});

test("renders six figures and drops a seventh", () => {
  const six = [1, 2, 3, 4, 5, 6].map(fig);
  assert.equal(count(render(six)), 6);
  assert.equal(count(render([...six, fig(7)])), 6);
  assert.doesNotMatch(render([...six, fig(7)]), /Label 7/);
});

test("renders nothing with fewer than three valid figures or no list", () => {
  assert.equal(render([fig(1), fig(2)]), "");
  assert.equal(render([fig(1), fig(2), { value: "5" }, { label: "x" }, "no", null]), "");
  assert.equal(render(undefined), "");
  assert.equal(render("nope"), "");
});

test("drops invalid entries and keeps the rest in order", () => {
  const out = render([fig(1), { value: "", label: "x" }, fig(2), fig(3)]);
  assert.equal(count(out), 3);
  assert.ok(out.indexOf("Label 1") < out.indexOf("Label 2") && out.indexOf("Label 2") < out.indexOf("Label 3"));
});

test("a safe link wraps the label; an unsafe one leaves plain text", () => {
  const out = render([
    { value: "1", label: "Safe", url: "/docs/" },
    { value: "2", label: "Bad", url: "javascript:alert(1)" },
    { value: "3", label: "Ext", url: "https://example.com/x" },
    { value: "4", label: "Proto", url: "//evil.example" },
  ]);
  assert.match(out, /<a class="stat-label" href="\/docs\/">Safe<\/a>/);
  assert.match(out, /<a class="stat-label" href="https:\/\/example.com\/x">Ext<\/a>/);
  assert.match(out, /<span class="stat-label">Bad<\/span>/);
  assert.match(out, /<span class="stat-label">Proto<\/span>/);
  assert.doesNotMatch(out, /javascript:|evil/);
});

test("a long label is kept whole and escaped", () => {
  const label = "A very long label that goes on and on <b>across</b> several lines of a narrow column ".repeat(3).trim();
  const out = render([{ value: "9", label }, fig(2), fig(3)]);
  assert.doesNotMatch(out, /<b>/);
  assert.ok(out.includes(label.replaceAll("<", "&lt;")));
});

test("Persian and Arabic digits stay as authored, and numbers are not reformatted", () => {
  const out = render([
    { value: "۱٬۲۰۰", label: "کاربر" },
    { value: "٣٤٥", label: "مستخدم" },
    { value: 1200, label: "Plain" },
    { value: "99.9%", label: "Up" },
  ]);
  assert.match(out, /stat-value">۱٬۲۰۰</);
  assert.match(out, /stat-value">٣٤٥</);
  assert.match(out, /stat-value">1200</);
  assert.match(out, /stat-value">99\.9%</);
});

test("the stats prop overrides front matter and src is kept", () => {
  const out = render([fig(1)], { stats: [fig(4), fig(5), fig(6)], src: "a.md:3" });
  assert.match(out, /Label 4/);
  assert.match(out, /data-src="a.md:3"/);
});

test("statsOf takes only arrays", () => {
  assert.deepEqual(statsOf({}), []);
});

test("the stylesheet uses tabular numerals, wraps to two rows, and has no animation", () => {
  const css = readFileSync(new URL("../components/stat-strip/style.css", import.meta.url), "utf8");
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(css, /animation|transition|@keyframes/);
  assert.doesNotMatch(css, /margin-left|padding-left|text-align:\s*(left|right)/);
});
