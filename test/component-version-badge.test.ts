import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import { stringsOf } from "../i18n/index.ts";
import versionBadge, {
  DEFAULT_VARIANT,
  ICONS,
  LABEL_KEYS,
  UNKNOWN_VARIANT,
  VARIANTS,
  blockOf,
  classNameOf,
  directive,
  variantOf,
  versionOf,
  type VersionBadgeProps,
  type VersionBadgeState,
} from "../components/version-badge/index.ts";

/** Render the badge the way the render host calls it: directive props and the page's language. */
function render(props: VersionBadgeProps, lang = "en"): string | null {
  const input = { props, html: "", page: { lang }, site: {} } as unknown as ComponentProps<VersionBadgeProps>;
  const node = versionBadge(input);
  return node === null ? null : renderToString(node as never);
}

const names = JSON.parse(readFileSync(new URL("../tokens/names.json", import.meta.url), "utf8")) as Record<
  string,
  Record<string, unknown>
>;
const tokenNames = new Set(
  Object.entries(names).flatMap(([group, entries]) => Object.keys(entries).map((name) => `${group}-${name}`)),
);

const css = "" /* lateen-legacy removed: components/version-badge/style.css */;

test("default export is the component and the directive is version-badge", () => {
  assert.equal(typeof versionBadge, "function");
  assert.equal(directive, "version-badge");
  assert.deepEqual([...VARIANTS], ["added", "changed", "removed"]);
  assert.equal(DEFAULT_VARIANT, "added");
  assert.equal(UNKNOWN_VARIANT, "unknown");
});

test("renders v<version> and each variant's icon and class", () => {
  for (const variant of VARIANTS) {
    const out = render({ version: "0.3", variant });
    assert.ok(out, `${variant} renders`);
    assert.match(out, new RegExp(`class="version-badge version-badge-${variant}"`));
    assert.match(out, new RegExp(`data-variant="${variant}"`));
    assert.match(out, /class="version-badge-value"[^>]*>v0\.3</);
    assert.ok(out.includes(`>${ICONS[variant]}<`), `${variant} shows its icon`);
    assert.match(out, new RegExp(`class="version-badge-sr">${stringsOf("en")[LABEL_KEYS[variant]]!.replace("{version}", "0\\.3")}<`));
  }
});

test("a screen reader hears the full sentence while the visible value is hidden from it", () => {
  const out = render({ version: "0.3" });
  assert.ok(out);
  assert.match(out, /<span class="version-badge-sr">Added in version 0\.3<\/span>/);
  assert.match(out, /class="version-badge-icon" aria-hidden="true"/);
  assert.match(out, /<bdi class="version-badge-value" aria-hidden="true" dir="ltr"/);
});

test("the screen-reader sentence follows the page language", () => {
  for (const lang of ["en", "fa", "ar"] as const) {
    const out = render({ version: "0.3", variant: "removed" }, lang);
    assert.ok(out);
    const expected = stringsOf(lang)[LABEL_KEYS.removed]!.replace("{version}", "0.3");
    assert.ok(out.includes(`>${expected}<`), `${lang} says "${expected}"`);
  }
});

test("the three i18n keys exist with the version placeholder in every language", () => {
  for (const lang of ["en", "fa", "ar"] as const) {
    for (const key of Object.values(LABEL_KEYS)) {
      const text = stringsOf(lang)[key];
      assert.equal(typeof text, "string", `${lang}.${key}`);
      assert.match(text!, /\{version\}/, `${lang}.${key} has the version placeholder`);
    }
  }
});

test("inline by default and block with the block word", () => {
  const inline = render({ version: "0.3" });
  assert.ok(inline);
  assert.doesNotMatch(inline, /version-badge-block/);

  for (const block of ["", "true", "block"]) {
    const out = render({ version: "0.3", block });
    assert.ok(out);
    assert.match(out, /class="version-badge version-badge-added version-badge-block"/);
  }
  assert.doesNotMatch(render({ version: "0.3", block: "false" })!, /version-badge-block/);
  assert.equal(blockOf(undefined), false);
  assert.equal(blockOf("off"), false);
  assert.equal(blockOf(""), true);
});

test("a missing, blank, or non-string version renders nothing", () => {
  assert.equal(render({}), null);
  assert.equal(render({ version: "" }), null);
  assert.equal(render({ version: "   " }), null);
  assert.equal(render({ version: 42 as unknown as string }), null);
  assert.equal(versionOf(undefined), undefined);
  assert.equal(versionOf("<b>"), "<b>");
});

test("an omitted or blank variant keeps the documented added default", () => {
  assert.equal(variantOf(undefined), "added");
  assert.equal(variantOf(null), "added");
  assert.equal(variantOf(false), "added");
  assert.equal(variantOf(""), "added");
  assert.equal(variantOf("   "), "added");
  assert.match(render({ version: "0.3" })!, /version-badge-added/);
  assert.match(render({ version: "0.3", variant: "" })!, /version-badge-added/);
  assert.equal(classNameOf("changed"), "version-badge version-badge-changed");
});

test("an explicit invalid variant is unknown, never added", () => {
  for (const value of ["purple", "add", "0", "true", 42, {}]) {
    assert.equal(variantOf(value), "unknown", `variantOf(${String(value)})`);
  }
  const out = render({ version: "0.3", variant: "purple" });
  assert.ok(out);
  assert.match(out, /class="version-badge version-badge-unknown"/);
  assert.match(out, /data-variant="unknown"/);
  assert.doesNotMatch(out, /version-badge-added|data-variant="added"/);
  assert.match(out, /class="version-badge-icon" aria-hidden="true">\?</);
  assert.equal(classNameOf("unknown"), "version-badge version-badge-unknown");
});

test("known variants are trimmed and matched without case", () => {
  for (const value of ["changed", " Changed ", "CHANGED", "\tremoved\n", "ADDED"]) {
    const expected = value.trim().toLowerCase();
    assert.equal(variantOf(value), expected, JSON.stringify(value));
    assert.match(render({ version: "0.3", variant: value })!, new RegExp(`version-badge-${expected}`));
  }
});

test("an unknown variant announces the version without inventing a change", () => {
  const out = render({ version: "0.3", variant: "purple" }, "fa");
  assert.ok(out);
  assert.doesNotMatch(out, /version-badge-sr/);
  assert.doesNotMatch(out, /Added in version|version_added/);
  assert.match(out, /<bdi class="version-badge-value" dir="ltr">v0\.3</);
  assert.doesNotMatch(out, /class="version-badge-value" aria-hidden/);
  assert.match(out, /data-version="0\.3"/);
  assert.match(out, /data-variant="unknown"/);
});

test("Unicode versions keep their exact text in the value and the attribute", () => {
  const version = "۱.۰-β";
  const out = render({ version, variant: "changed" }, "fa");
  assert.ok(out);
  assert.ok(out.includes(`>v${version}<`));
  assert.ok(out.includes(`data-version="${version}"`));
  assert.match(out, /<bdi class="version-badge-value"[^>]*dir="ltr"/);
});

test("a prerelease version keeps its dots and hyphens, isolated in both page directions", () => {
  const version = "1.2.0-beta.1";
  for (const lang of ["en", "fa", "ar"]) {
    const out = render({ version }, lang);
    assert.ok(out, `${lang} renders`);
    assert.ok(out.includes(`<bdi class="version-badge-value" aria-hidden="true" dir="ltr">v${version}</bdi>`), lang);
    assert.ok(out.includes(`data-version="${version}"`), lang);
  }
});

test("an unknown variant keeps the version escaped, in RTL and LTR pages alike", () => {
  for (const lang of ["en", "fa", "ar"]) {
    const out = render({ version: '<b>"x"</b>', variant: "bogus" }, lang);
    assert.ok(out);
    assert.doesNotMatch(out, /<b>/);
    assert.match(out, /data-version="&lt;b>&quot;x&quot;&lt;\/b>"/);
    assert.match(out, /v&lt;b>&quot;x&quot;&lt;\/b>/);
    assert.doesNotMatch(out, /Added in version/);
  }
});

test("version text and its attribute are escaped, never parsed as markup", () => {
  const out = render({ version: '<script>alert("x")</script> &' });
  assert.ok(out);
  assert.doesNotMatch(out, /<script>/);
  assert.match(out, /v&lt;script>alert\(&quot;x&quot;\)&lt;\/script> &amp;/);
  assert.match(out, /data-version="&lt;script>alert\(&quot;x&quot;\)&lt;\/script> &amp;"/);
  assert.match(out, /Added in version &lt;script>/);
  assert.doesNotMatch(out, /dangerouslySetInnerHTML/);
});

test("each state has a different icon, so color is never the only signal", () => {
  const states: readonly VersionBadgeState[] = [...VARIANTS, UNKNOWN_VARIANT];
  const icons = states.map((state) => ICONS[state]);
  assert.equal(new Set(icons).size, states.length);
  for (const icon of icons) assert.notEqual(icon.trim(), "");
});

