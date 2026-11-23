// Public acceptance scenario. With --out it tests the exact Pages artifact before upload.
// With --url it repeats the scenario on the public deployment. Without either it builds the docs.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { Ajv2020 } from "ajv/dist/2020.js";
import { chromium, type Locator } from "playwright";
import { parse, stringify } from "yaml";
import { FONTS, STUDIO_PRESETS } from "../components/brand-studio/model.ts";
import { resolveBrand } from "../src/brand.ts";
import { startServer } from "../visual/index.ts";
import { commitOf, root, versionOf } from "./report.ts";
import { withCleanup } from "./runner-cleanup.ts";

const flags = process.argv.slice(2);
const arg = (name: string) => flags.includes(name) ? flags[flags.indexOf(name) + 1] : undefined;
const mizzen = join(root, "node_modules/.bin/mizzen");

function run(args: string[], cwd = root): void {
  const result = spawnSync(mizzen, args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /0 errors/);
}

/** Use the computed styles a reader sees, including Shiki's inline declarations. */
function appearance(scope: Locator) {
  return scope.evaluate((element) => {
    const style = (selector: string) => getComputedStyle(element.querySelector(selector)!);
    const container = getComputedStyle(element);
    return {
      ink: container.getPropertyValue("--foreground").trim(),
      paper: container.getPropertyValue("--background").trim(),
      ring: container.getPropertyValue("--ring").trim(),
      inlineLink: style('a[href="#apply-settings"]').color,
      note: style(".callout").backgroundColor,
      status: style(".status-label").color,
      codeBg: style(".code").backgroundColor,
      codeInk: style(".code .line span").color,
      codeFont: style(".code").fontFamily,
      proseFont: style("p").fontFamily,
    };
  });
}

await withCleanup(async (cleanup) => {
  const tmp = cleanup.tempDir("lateen-theme-studio-");
  const published = arg("--url");
  let origin = published === undefined ? "" : published.replace(/\/$/, "");
  if (published === undefined) {
    const output = arg("--out") === undefined ? join(tmp, "docs") : resolve(arg("--out")!);
    if (arg("--out") === undefined) run(["build", "site", "--theme", ".", "--out", output]);
    const server = await startServer(output, "/lateen");
    cleanup.add(() => server.close());
    origin = server.url + "/lateen";
  }

  const browser = await chromium.launch();
  cleanup.add(() => browser.close());
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const requestUrls = new Set<string>();
  page.on("request", (request) => requestUrls.add(request.url()));
  const route = `${origin}/theme-studio/`;
  const ordinary = await page.goto(`${origin}/install/`);
  assert.ok(ordinary?.ok());
  await page.waitForLoadState("networkidle");
  const ordinaryAssets = [...requestUrls].filter((url) => /\.(?:css|js|woff2?)(?:\?|$)/.test(url));

  await page.goto(`${origin}/presets/`);
  const presetLinks = new Map<string, string>();
  for (const preset of STUDIO_PRESETS) {
    const href = await page.locator(`a[href$="theme-studio/?preset=${preset}"]`).getAttribute("href");
    assert.ok(href, preset);
    presetLinks.set(preset, new URL(href, page.url()).href);
  }
  const schema = JSON.parse(readFileSync(join(root, "schema/options.schema.json"), "utf8"));
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
  const presetControl = page.getByRole("combobox", { name: "Preset", exact: true });
  const yaml = page.locator("[data-studio-yaml]");
  const copy = page.getByRole("button", { name: "Copy YAML", exact: true });
  const parseOptions = async () => {
    const { theme: { options } } = parse(await yaml.innerText());
    assert.ok(validate(options), JSON.stringify(validate.errors));
    assert.deepEqual(resolveBrand(options).problems, []);
    return options;
  };
  for (const [preset, href] of presetLinks) {
    const opened = await page.goto(href);
    assert.ok(opened?.ok(), href);
    await presetControl.waitFor({ timeout: 8000 });
    assert.equal(await presetControl.inputValue(), preset);
    assert.deepEqual(await parseOptions(), { preset });
  }
  assert.equal(presetLinks.size, 5);

  requestUrls.clear();
  const response = await page.goto(route);
  assert.ok(response?.ok());
  await presetControl.waitFor();
  await page.waitForLoadState("networkidle");
  const extras = [...requestUrls].filter((url) => /\.(?:css|js)(?:\?|$)/.test(url) && !ordinaryAssets.includes(url));
  // Module imports shared with other pages, but missing from this page's comparison route, still count.
  const bytes = await Promise.all(extras.map(async (url) => {
    const asset = await context.request.get(url);
    assert.ok(asset.ok(), url);
    return gzipSync(await asset.body()).byteLength;
  }));
  const gzipBytes = bytes.reduce((sum, value) => sum + value, 0);
  assert.ok(gzipBytes <= 12 * 1024, `Studio assets use ${gzipBytes} gzip bytes`);
  assert.ok(!ordinaryAssets.some((url) => /brand-studio|source-(?:sans-3|code-pro)/.test(url)));
  assert.ok(![...requestUrls].some((url) => url.includes("/fonts/source-")));

  await presetControl.focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").getAttribute("name"), "accent");
  const accent = page.getByLabel("Accent color", { exact: true });
  await accent.fill("blue");
  assert.equal(await accent.getAttribute("aria-invalid"), "true");
  assert.ok(await copy.isDisabled());
  assert.deepEqual(await parseOptions(), { preset: "harbor" });
  await accent.fill("#0b6e4f");
  await page.getByLabel("Neutral tint", { exact: true }).fill("#b2957e");
  await page.getByRole("combobox", { name: "Text font", exact: true }).selectOption(FONTS.sans.family);
  await page.getByRole("combobox", { name: "Code font", exact: true }).selectOption(FONTS.mono.family);
  const more = page.getByText("More settings", { exact: true });
  await more.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("combobox", { name: "Corner radius", exact: true }).selectOption("small");
  await page.getByRole("combobox", { name: "Density", exact: true }).selectOption("compact");
  await copy.click();
  await page.getByText("YAML copied.", { exact: true }).waitFor();
  const exported = await parseOptions();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await yaml.innerText());
  assert.equal(exported.brand.density, "compact");
  assert.equal(exported.brand.radius, "small");
  assert.equal(exported.brand.accent, "#0b6e4f");
  assert.equal(exported.brand.neutral, "#b2957e");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  for (const role of ["sans", "mono"] as const) {
    const { family, files } = FONTS[role];
    assert.ok(await page.evaluate((name) => [...document.fonts].some((font) => font.family.includes(name) && font.status === "loaded"), family));
    assert.ok([...requestUrls].some((url) => url.endsWith(files[0].src)), family);
  }

  const site = join(tmp, "site");
  mkdirSync(site);
  writeFileSync(join(site, "mizzen.yml"), stringify({ title: "Consumer", theme: { options: exported } }));
  writeFileSync(join(site, "index.md"), [
    "---", "title: Connection guide", "layout: doc", "---",
    "", "[See the settings](#apply-settings)", "",
    ":status[Ready]{tone=positive}", "",
    ':::tip{title="Test your connection"}', "Start with three retries and see how the client responds.", ":::", "",
    "```js", "const retries = 3;", "await connect({ retries });", "```", "", "## Apply the settings", "",
  ].join("\n"));
  for (const role of ["sans", "mono"] as const) {
    const relative = FONTS[role].files[0].src;
    const file = join(site, relative);
    const font = await context.request.get(origin + relative);
    assert.ok(font.ok(), relative);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await font.body()));
  }
  run(["check", "site", "--theme", root], tmp);
  const installedOutput = join(tmp, "consumer");
  run(["build", "site", "--theme", root, "--out", installedOutput], tmp);
  const consumerServer = await startServer(installedOutput, "");
  cleanup.add(() => consumerServer.close());
  const consumer = await context.newPage();
  const preview = page.locator("[data-studio-preview]");
  for (const mode of ["light", "dark"] as const) {
    await consumer.goto(consumerServer.url);
    await consumer.evaluate((value) => document.documentElement.dataset.theme = value, mode);
    await page.getByRole("button", { name: mode === "light" ? "Light" : "Dark", exact: true }).click();
    assert.deepEqual(await appearance(preview), await appearance(consumer.locator(".doc-body")), mode);
  }

  await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
  assert.equal(await preview.evaluate((element) => getComputedStyle(element).colorScheme), "light");
  assert.equal(await copy.isVisible(), false);
  assert.equal(await yaml.isVisible(), true);
  await page.emulateMedia({ media: "screen", forcedColors: "active" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await preview.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
  const undersized = await page.locator(".brand-studio :is(button, input, select, summary):visible").evaluateAll((controls) =>
    controls.filter((control) => {
      const { width, height } = control.getBoundingClientRect();
      return width < 24 || height < 24;
    }).map((control) => control.textContent ?? control.getAttribute("name")));
  assert.deepEqual(undersized, [], "visible controls meet the compact target size");
  assert.equal(await copy.isVisible(), true);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { value: undefined }));
  await copy.click();
  await page.getByText("Select the YAML and copy it manually.", { exact: true }).waitFor();

  const fallback = await browser.newPage({ javaScriptEnabled: false });
  await fallback.goto(route);
  assert.equal(await fallback.getByRole("combobox", { name: "Preset", exact: true }).isVisible(), false);
  assert.equal(await fallback.getByRole("heading", { name: "Connection guide" }).isVisible(), true);
  assert.equal(await fallback.locator("[data-studio-yaml]").innerText(), "theme:\n  options:\n    preset: harbor");
  const markdown = await context.request.get(route + "index.md");
  assert.ok(markdown.ok());
  assert.match(await markdown.text(), /theme\.options[\s\S]*preset: harbor/);

  const evidence = {
    scenario: "theme-studio-export", result: "passed", url: published ? route : "/lateen/theme-studio/",
    commit: commitOf(), mizzen: versionOf("@velella/mizzen"),
    htmlSha256: createHash("sha256").update(await response.body()).digest("hex"), gzipBytes,
  };
  console.log(JSON.stringify(evidence, null, 2));
});
