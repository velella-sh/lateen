import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compare, countRaw, countSource, type Counts } from "../scripts/check-type-ratchet.ts";

test("countRaw counts raw sizes and leadings, not tokens or keywords", () => {
  const css = `
    a { font-size: 0.9rem; line-height: 1.4; }
    b { font-size: var(--type-size-sm); line-height: var(--type-leading-ui); }
    c { font-size: inherit; line-height: normal; }
    /* font-size: 3rem; */
    d { content: "font-size: 2rem;"; @apply text-sm font-bold md:text-xl; }
  `;
  assert.deepEqual(countRaw(css), { "font-size": 1, "line-height": 1, "text-utility": 2 });
});

test("compare fails on growth and on a stale baseline", () => {
  const base: Counts = { "font-size": 3, "line-height": 2, "text-utility": 1 };
  assert.deepEqual(compare(base, base), []);
  assert.equal(compare({ ...base, "font-size": 4 }, base).length, 1);
  assert.match(compare({ ...base, "line-height": 1 }, base)[0] ?? "", /under the baseline/);
});

test("the sailcloth source holds no more raw type values than the baseline", () => {
  const baseline = JSON.parse(readFileSync(new URL("./type-ratchet.json", import.meta.url), "utf8")) as Counts;
  assert.deepEqual(compare(countSource(), baseline), []);
});
