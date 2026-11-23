import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { renderToString } from "preact-render-to-string";
import { parse } from "yaml";
import brandStudio from "../components/brand-studio/index.ts";
import { FONTS, optionsYaml, overridesOf, passesContrast, type StudioInput } from "../components/brand-studio/model.ts";
import { presetNames, resolveBrand } from "../src/brand.ts";
import { pageWith } from "./helpers/page.ts";
import { siteOf } from "./helpers/site.ts";

const schema = JSON.parse(readFileSync(new URL("../schema/options.schema.json", import.meta.url), "utf8"));
const validate = new Ajv2020({ strict: false }).compile(schema);

test("each public preset exports only the selected changes and resolves the same way at build time", () => {
  for (const name of presetNames()) {
    const preset = resolveBrand({ preset: name }).brand;
    assert.ok(preset?.accent && preset.neutral && preset.radius && preset.density);
    const input: StudioInput = { accent: preset.accent, neutral: preset.neutral,
      radius: preset.radius, density: preset.density, sans: "", mono: "" };
    assert.ok(passesContrast(preset, []));
    assert.deepEqual(overridesOf(preset, input), {});
    assert.deepEqual(parse(optionsYaml(name, {})).theme.options, { preset: name });
    for (const changes of [
      { accent: "#abc" }, { neutral: "#abc" },
      { radius: "none" }, { radius: "large" }, { density: "compact" }, { density: "comfortable" },
      { sans: FONTS.sans.family }, { mono: FONTS.mono.family }, { sans: FONTS.sans.family, mono: FONTS.mono.family },
    ]) {
      const overrides = overridesOf(preset, { ...input, ...changes });
      assert.ok(overrides);
      const options = parse(optionsYaml(name, overrides)).theme.options;
      assert.ok(validate(options), JSON.stringify(validate.errors));
      assert.deepEqual(resolveBrand(options).problems, []);
    }
    assert.equal(overridesOf(preset, { ...input, accent: "red" }), undefined);
    assert.equal(overridesOf(preset, { ...input, sans: "unlisted" }), undefined);
    assert.equal(overridesOf(preset, { ...input, radius: "7px" }), undefined);
  }
});

test("initial component output includes a real guide, hidden controls and manually selectable YAML", () => {
  const out = renderToString(brandStudio({ props: {}, html: "", page: pageWith(), site: siteOf({ config: { base: "/docs" } }) }));
  assert.match(out, /<form[^>]+ hidden/);
  assert.match(out, /Connection guide/);
  assert.match(out, /class="status /);
  assert.match(out, /class="callout callout-tip"/);
  assert.match(out, /data-studio-syntax="#[a-f0-9]{6} #[a-f0-9]{6}"/i);
  assert.match(out, /data-studio-yaml="true">theme:\n  options:\n    preset: harbor/);
  assert.match(out, /href="\/docs\/fonts\/source-sans-3\//);
});
