import assert from "node:assert/strict";
import { test } from "node:test";
import { isRecord, knownOf, knownOr, parseJson, textOf } from "../src/guards.ts";
import {
  isRecord as entryIsRecord,
  knownOf as entryKnownOf,
  parseJson as entryParseJson,
  textOf as entryTextOf,
  theme,
} from "../src/index.ts";
import { DEFAULT_TONE, ICONS as TONE_ICONS, TONES } from "../components/status/index.ts";
import { statusOf as pageStatusOf } from "../components/page-status/index.ts";
import { statusOf as bannerStatusOf } from "../components/status-banner/index.ts";
import { variantOf as versionVariantOf } from "../components/version-badge/index.ts";
import { kindOf as diffKindOf } from "../components/version-diff/changes.ts";
import { statusOf as versionStatusOf } from "../layouts/versions.ts";
import { categoriesOf } from "../components/changelog-entry/index.ts";

test("a plain object passes, including nested and boxed objects", () => {
  assert.equal(isRecord({}), true);
  assert.equal(isRecord({ field: "value" }), true);
  assert.equal(isRecord(new Date()), true);
  assert.equal(isRecord({ nested: { deep: 1 } }), true);
});

test("null, arrays, and non-objects are rejected", () => {
  assert.equal(isRecord(null), false);
  assert.equal(isRecord(undefined), false);
  assert.equal(isRecord([]), false);
  assert.equal(isRecord([{}]), false);
  assert.equal(isRecord("object"), false);
  assert.equal(isRecord(1), false);
  assert.equal(isRecord(true), false);
  assert.equal(isRecord(() => 1), false);
});

test("narrowing reads fields without a cast", () => {
  const values: unknown[] = [{ name: "one" }, "two", null, [3]];
  const names = values.filter(isRecord).flatMap((value) => (typeof value.name === "string" ? [value.name] : []));
  assert.deepEqual(names, ["one"]);
});

test("the theme entry still names its folders and re-exports the same guard", () => {
  assert.equal(theme.name, "lateen");
  assert.equal(entryIsRecord({ ok: true }), true);
  assert.equal(entryIsRecord(null), false);
  assert.equal(entryIsRecord([]), false);
});

test("textOf trims a non-empty string and drops absent, blank, and non-string values", () => {
  assert.equal(textOf("  spaced  "), "spaced");
  assert.equal(textOf("title"), "title");
  assert.equal(textOf(undefined), undefined);
  assert.equal(textOf(null), undefined);
  assert.equal(textOf(""), undefined);
  assert.equal(textOf("   "), undefined);
  assert.equal(textOf("\n\t"), undefined);
  assert.equal(textOf(7), undefined);
  assert.equal(textOf(true), undefined);
  assert.equal(textOf({ text: "title" }), undefined);
  assert.equal(textOf(["title"]), undefined);
});

test("textOf keeps mixed-direction text exactly as written apart from the trimmed ends", () => {
  const rtl = "سلام بر همه";
  const mixed = "result: نتیجه ← ۱溪";
  assert.equal(textOf(`  ${rtl} `), rtl);
  assert.equal(textOf(mixed), mixed);
  // Direction marks inside the value survive: only string ends are trimmed.
  const isolated = "\u200fmark";
  assert.equal(textOf(isolated), isolated);
});

test("the entry re-exports textOf", () => {
  assert.equal(entryTextOf(" x "), "x");
  assert.equal(entryTextOf("  "), undefined);
});

test("parseJson yields the value as unknown data and never asserts a shape", () => {
  assert.deepEqual(parseJson("{\"n\":1}"), { n: 1 });
  assert.equal(parseJson("null"), null);
  assert.deepEqual(parseJson("[1,2]"), [1, 2]);
  assert.equal(parseJson("\"\""), "");
  assert.equal(parseJson("nope"), undefined);
  assert.equal(parseJson("{"), undefined);
  assert.equal(parseJson(""), undefined);
  // A parsed value is data, not a trusted shape: fields need the caller's own narrowing.
  const value = parseJson("{\"deep\":{\"x\":1}}");
  assert.equal(isRecord(value) && isRecord(value.deep) && value.deep.x === 1, true);
});

test("the entry re-exports parseJson", () => {
  assert.deepEqual(entryParseJson("[true]"), [true]);
  assert.equal(entryParseJson("}"), undefined);
});

test("knownOf trims, ignores case, and returns the vocabulary's own spelling", () => {
  assert.equal(knownOf(["added", "removed"], " Added "), "added");
  assert.equal(knownOf(["added", "removed"], "REMOVED"), "removed");
  for (const value of [undefined, null, 3, true, {}, [], "", "  ", "extra"]) {
    assert.equal(knownOf(["added", "removed"], value), undefined);
  }
});

test("knownOr keeps the documented fallback for a missing or unknown value", () => {
  assert.equal(knownOr(TONES, " POSITIVE ", DEFAULT_TONE), "positive");
  assert.equal(knownOr(TONES, "loud", DEFAULT_TONE), DEFAULT_TONE);
  assert.equal(knownOr(TONES, undefined, DEFAULT_TONE), DEFAULT_TONE);
});

test("an unknown tone falls back to one that still carries an icon and text, never colour alone", () => {
  for (const value of ["loud", "", undefined, 7]) {
    const tone = knownOr(TONES, value, DEFAULT_TONE);
    assert.ok(TONES.includes(tone));
    assert.ok(TONE_ICONS[tone], "every tone, the fallback included, has its own non-colour signal");
  }
});

test("the entry re-exports knownOf", () => {
  assert.equal(entryKnownOf(["added"], " AddEd "), "added");
  assert.equal(entryKnownOf(["added"], "other"), undefined);
});

test("each status vocabulary keeps its documented fallback for a missing or unknown value", () => {
  assert.equal(pageStatusOf("Beta"), "beta");
  assert.equal(pageStatusOf("bogus"), undefined);
  assert.equal(bannerStatusOf("Old_Version"), "old-version");
  assert.equal(bannerStatusOf("bogus"), undefined);
  assert.equal(versionVariantOf(" Changed "), "changed");
  assert.equal(versionVariantOf("bogus"), "unknown");
  assert.equal(diffKindOf("MOVED"), "moved");
  assert.equal(diffKindOf("bogus"), undefined);
  assert.equal(versionStatusOf("old"), "deprecated");
  assert.equal(versionStatusOf("bogus"), undefined);
  assert.deepEqual(categoriesOf(["Fixed", "bogus"]), ["fixed"]);
});
