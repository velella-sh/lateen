// The sailcloth source must not carry the same rule twice (#864): a repeated
// .code/.code-frame highlighted-span block shipped once and is gone. This scan
// fails when any selector repeats its exact declarations in the same cascade
// context (layer/media/supports/container), so the duplicate cannot return.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readUiCss } from "./ui-css-helpers.ts";

type Rule = { context: string; selector: string; body: string };

/** Every rule block in a sheet, keyed by its enclosing at-rule context. */
function rules(source: string): Rule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: Rule[] = [];
  const walk = (src: string, context: string): void => {
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf("{", i);
      if (open === -1) break;
      const head = src.slice(i, open).trim().replace(/\s+/g, " ");
      let depth = 1;
      let j = open + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === "{") depth += 1;
        else if (src[j] === "}") depth -= 1;
        j += 1;
      }
      const body = src.slice(open + 1, j - 1);
      if (head.startsWith("@")) {
        if (/^@(media|supports|layer|container)\b/.test(head)) walk(body, `${context} > ${head}`);
      } else if (head) {
        const declarations = body.split(";").map((part) => part.trim()).filter(Boolean).sort().join(";");
        found.push({ context, selector: head, body: declarations });
      }
      i = j;
    }
  };
  walk(text, "sheet");
  return found;
}

test("no sailcloth rule repeats its exact declarations in the same cascade context", () => {
  const seen = new Map<string, Rule>();
  const duplicates: string[] = [];
  for (const rule of rules(readUiCss())) {
    const key = `${rule.context} || ${rule.selector} || ${rule.body}`;
    if (seen.has(key)) duplicates.push(`${rule.context}: ${rule.selector}`);
    else seen.set(key, rule);
  }
  assert.deepEqual(duplicates, []);
});

test("the highlighted-line span colour is declared once, without !important", () => {
  const hits = rules(readUiCss()).filter(
    (rule) => rule.selector === ".code .highlighted span, .code-frame .highlighted span",
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.body, "color: var(--code-fg)");
});