import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser, Page } from "playwright";
import { stringify } from "yaml";
import { contrast, parseHex } from "../../src/color.ts";
import { startServer } from "../../visual/index.ts";
import { waitFor } from "../helpers/wait.ts";
import type { CaseResult } from "./ledger.ts";

const presets = ["mizzen", "lateen", "offing", "ebb"] as const;
const cases = ["preset", "navigation", "local-search", "readme-badges"] as const;
export const FAMILY_CASE_NAMES = cases.map((name) => "family-identity-" + name);

/** Read a rendered token as a resolved colour in the browser's current scheme. */
async function colours(page: Page, selector: string): Promise<readonly string[]> {
  return page.locator(selector).evaluate((node) => {
    const probe = document.createElement("span");
    probe.hidden = true;
    node.append(probe);
    const values = ["canvas", "surface", "text", "link", "focus"].map((role) => {
      probe.style.color = "var(--color-" + role + ")";
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      context.fillStyle = getComputedStyle(probe).color;
      return context.fillStyle;
    });
    probe.remove();
    return values;
  });
}

function ratio(first: string, second: string): number {
  const a = parseHex(first);
  const b = parseHex(second);
  assert.ok(a && b, `${first}, ${second}`);
  return contrast(a, b);
}

function buildSites(root: string, project: string): void {
  const source = "https://velella.sh/network.json";
  const bytes = readFileSync(join(root, "test/acceptance/fixtures/network.json"));
  const lock = readFileSync(join(root, "site/network.lock.json"), "utf8");
  const parsedLock = JSON.parse(lock);
  assert.equal(parsedLock.source, source);
  assert.equal(parsedLock.sha256, createHash("sha256").update(bytes).digest("hex"));
  // The lock also pins each public project's page list; the shared list has the rest.
  assert.deepEqual(parsedLock.projects.map(({ manifest: _manifest, ...project }: Record<string, unknown>) => project), JSON.parse(bytes.toString()).projects);

  for (const preset of [...presets, "independent"] as const) {
    const member = preset !== "independent";
    const site = join(project, "family", preset);
    mkdirSync(site, { recursive: true });
    writeFileSync(join(site, "mizzen.yml"), stringify({
      title: preset,
      url: "https://example.com",
      base: "/" + preset,
      ...(member ? { network: { source, project: preset } } : {}),
      theme: {
        name: "@velella/lateen",
        ...(member ? { options: {
          preset,
          network: { search: false },
          footer: { links: [{ title: "a Velella project", url: "https://velella.sh/" }] },
        } } : {}),
      },
    }));
    if (member) writeFileSync(join(site, "network.lock.json"), lock);
    writeFileSync(join(site, "index.md"),
      ["---", "title: Sextant manual for " + preset, "permalink: /", "---", "", "The sextant handbook."].join("\n") + "\n");
    copyFileSync(join(root, "site/search.md"), join(site, "search.md"));
    if (preset === "lateen") copyFileSync(join(root, "site/presets.md"), join(site, "presets.md"));
    execFileSync(join(project, "node_modules/.bin/mizzen"), [
      "build", site, "--out", join(project, "family-dist", preset),
    ], { cwd: project, stdio: ["ignore", "ignore", "inherit"] });
  }
}

export async function runFamilyIdentity(browser: Browser, root: string, project: string): Promise<CaseResult[]> {
  buildSites(root, project);
  const server = await startServer(join(project, "family-dist"), "");
  const checks: Record<(typeof cases)[number], () => Promise<void>> = {
    async preset() {
      const page = await browser.newPage();
      const preview = await browser.newPage();
      try {
        for (const scheme of ["light", "dark"] as const) {
          const expected = scheme === "light" ? ["#eceff4", "#e5e9f0", "#2e3440"] : ["#1f1f28", "#2a2a37", "#dcd7ba"];
          await page.emulateMedia({ colorScheme: scheme });
          await preview.emulateMedia({ colorScheme: scheme });
          await preview.goto(server.url + "/lateen/presets/");
          await preview.locator("html").evaluate((root, mode) => root.setAttribute("data-theme", mode), scheme);
          const links = new Set<string>();
          for (const preset of presets) {
            await page.goto(server.url + "/" + preset + "/");
            await page.locator("html").evaluate((root, mode) => root.setAttribute("data-theme", mode), scheme);
            const rendered = await colours(page, "html");
            assert.deepEqual(rendered.slice(0, 3), expected);
            assert.deepEqual(await colours(preview, '[data-preset-preview="' + preset + '"]'), rendered);
            const [canvas, surface, text, link, focus] = rendered;
            assert.ok(canvas && surface && text && link && focus);
            for (const background of [canvas, surface]) {
              assert.ok(ratio(text, background) >= 4.5);
              assert.ok(ratio(link, background) >= 4.5);
              assert.ok(ratio(focus, background) >= 3);
            }
            links.add(link);
          }
          assert.equal(links.size, presets.length);
        }
        await page.emulateMedia({ colorScheme: "light", forcedColors: "active" });
        await page.goto(server.url + "/lateen/");
        const current = page.locator('.network-footer [aria-current="true"]');
        const forced = await current.evaluate((element) => ({
          active: matchMedia("(forced-colors: active)").matches,
          border: getComputedStyle(element).borderTopStyle,
        }));
        assert.deepEqual(forced, { active: true, border: "solid" });
        await page.emulateMedia({ forcedColors: "none", colorScheme: "light" });
        await page.goto(server.url + "/independent/");
        await page.locator("html").evaluate((root) => root.setAttribute("data-theme", "light"));
        assert.equal((await colours(page, "html"))[0], "#f4f4f9");
        assert.equal(await page.locator("[data-brand], .project-switcher, .network-footer").count(), 0);
      } finally {
        await Promise.all([page.close(), preview.close()]);
      }
    },
    async navigation() {
      const page = await browser.newPage({ javaScriptEnabled: false });
      try {
        for (const preset of presets) {
          await page.goto(server.url + "/" + preset + "/");
          const signature = page.getByRole("link", { name: "a Velella project" });
          assert.equal(await signature.getAttribute("href"), "https://velella.sh/");
          const switcher = page.locator(".project-switcher");
          await switcher.locator("summary").press("Enter");
          assert.equal(await switcher.locator("details").getAttribute("open"), "");
          for (const selector of [".project-switcher", ".network-footer"]) {
            const links = page.locator(selector + " a");
            assert.deepEqual(await links.evaluateAll((items) => items.map((item) => item.getAttribute("href"))),
              presets.map((id) => "/" + id + "/"));
            assert.equal(await page.locator(selector + ' [aria-current="true"]').getAttribute("href"), "/" + preset + "/");
          }
          const next = presets[(presets.indexOf(preset) + 1) % presets.length];
          await page.locator(".network-footer summary").click();
          await page.locator('.network-footer a[href="/' + next + '/"]').click();
          assert.equal(new URL(page.url()).pathname, "/" + next + "/");
        }
      } finally {
        await page.close();
      }
    },
    async "local-search"() {
      const page = await browser.newPage();
      try {
        for (const preset of presets) {
          const fetched: string[] = [];
          const record = (request: { url(): string }) => {
            const path = new URL(request.url()).pathname;
            if (path.includes("/pagefind/") || path.endsWith("/pagefind-network.json")) fetched.push(path);
          };
          page.on("request", record);
          try {
            await page.goto(server.url + "/" + preset + "/search/?q=sextant&scope=all");
            const results = page.locator("[data-search-page] [data-search-results]");
            await results.getByText("Sextant manual for " + preset, { exact: true }).waitFor();
            assert.equal(await page.locator('[name="scope"], [data-search-scope-change], [data-search-scope]').count(), 0);
            await page.locator("[data-search-open]").click();
            await page.locator("dialog [data-search-input]").fill("sextant");
            const modalResults = page.locator("dialog [data-search-results]");
            await waitFor(async () => (await modalResults.textContent())?.includes("Sextant manual for " + preset) === true);
            assert.ok(fetched.some((path) => path.includes("/pagefind/")));
            assert.ok(fetched.every((path) => path.startsWith("/" + preset + "/pagefind/")), fetched.join(", "));
          } finally {
            page.off("request", record);
          }
        }
      } finally {
        await page.close();
      }
    },
    async "readme-badges"() {
      const page = await browser.newPage();
      try {
        await page.goto(server.url + "/lateen/presets/");
        const examples = await page.locator("pre").filter({ hasText: "Documentation: Mizzen" }).textContent();
        assert.ok(examples);
        const coloursByProject = { mizzen: "8A6220", lateen: "4C6F9A", offing: "6A5590", ebb: "3F6E66" };
        for (const preset of presets) {
          assert.ok(examples.includes("-" + coloursByProject[preset] + "?style=flat&labelColor=1F1F28"), preset + ": " + examples);
          assert.ok(examples.includes("(https://velella.sh/" + preset + "/)"));
        }
      } finally {
        await page.close();
      }
    },
  };
  try {
    const results: CaseResult[] = [];
    for (const name of cases) {
      try {
        await checks[name]();
        results.push({ name: "family-identity-" + name, ok: true });
      } catch (error) {
        results.push({ name: "family-identity-" + name, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return results;
  } finally {
    await server.close();
  }
}
