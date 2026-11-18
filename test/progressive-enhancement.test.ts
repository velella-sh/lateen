import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { all, attrs, build, textOf, type BuiltSite } from "./integration-helpers.ts";
import { renderToString } from "preact-render-to-string";
import projectSwitcher from "../chrome/project-switcher/index.ts";
import { mobileProjects } from "../chrome/project-switcher/mobile.ts";
import networkFooter from "../chrome/network-footer/index.ts";
import searchScope from "../chrome/search-scope/index.ts";

let site: BuiltSite;
let document: Document;

before(() => {
  site = build("integration");
  document = site.document("/guide/install/");
});

after(() => rmSync(site.out, { recursive: true, force: true }));

test("the status badge and legend read before any island runs", () => {
  const page = site.document("/status/");
  const article = page.querySelector("article.doc");
  assert.ok(article);
  const text = textOf(article);
  for (const expected of ["Done", "Blocked", "Late", "Past its date."]) {
    assert.ok(text.includes(expected), `the server-rendered article contains ${JSON.stringify(expected)}`);
  }
  assert.equal(all(page, ".status.status-positive").length, 2);
  assert.equal(all(page, ".status-legend > .status-legend-item").length, 2);
  assert.equal(all(page, ".status-legend .status-negative").length, 1);
});

test("the guide layout and its components read before their islands run", () => {
  const page = site.document("/guide/start/");
  const article = page.querySelector("article.guide");
  assert.ok(article, "the guide layout renders its article");
  const text = textOf(article);
  for (const expected of [
    "From",
    "To",
    "Time",
    "Risk",
    "Done",
    "0.1",
    "10 minutes",
    "Install the package.",
    "Keep the old output beside the new one",
    "npm run build",
  ]) {
    assert.ok(text.includes(expected), `the server-rendered guide contains ${JSON.stringify(expected)}`);
  }
  assert.equal(all(page, ".guide-summary-fact").length, 4, "every front-matter fact renders");
  assert.equal(all(page, ".steps > ol > li").length, 3);
  assert.equal(all(page, ".before-after .ba-pane").length, 2);
  assert.ok(page.querySelector(".trap"));
  assert.equal(all(page, ".check-list .check-item").length, 2);
});

test("the whole page reads before its islands run: prose, tabs, disclosures, output, and form defaults", () => {
  const article = document.querySelector("article.doc");
  assert.ok(article);
  const text = textOf(article);
  for (const expected of [
    "Install",
    "This guide installs the widget",
    "The body of a disclosure that starts closed",
    "Finished {{project}} in 340 ms",
    "Install the widget",
    "Read the output",
    "Returns one widget",
  ]) {
    assert.ok(text.includes(expected), `the server-rendered article contains ${JSON.stringify(expected)}`);
  }

  // Every panel is in the document and visible without the island's tab machinery.
  assert.equal(all(document, ".tabs > [role='tabpanel']").length, 2);
  assert.equal(all(document, ".code-tabs-panel").length, 2);
  assert.equal(all(document, ".tabs > [role='tabpanel']:not([hidden])").length, 2);
  assert.equal(all(document, ".code-tabs-panel:not([hidden])").length, 2);
  // The tab lists are the only part the island adds; they start hidden.
  for (const list of all(document, ".tabs > [role='tablist'], .code-tabs-list")) {
    assert.equal(list.hasAttribute("hidden"), true);
  }

  const inputs = all(document, ".variables-form-input");
  assert.deepEqual(
    inputs.map((input) => [input.getAttribute("data-var"), (input as HTMLInputElement).value]),
    [
      ["api_key", "YOUR_KEY"],
      ["host", "https://api.example.com"],
    ],
  );
  for (const input of inputs) {
    const id = input.getAttribute("id");
    assert.ok(id);
    assert.equal(document.querySelector(`label[for="${id}"]`)?.textContent, input.getAttribute("data-var"));
  }
});

test("no control that needs an island is visible before hydration", () => {
  const ids = [
    "[data-search-open]",
    "[data-video-play]",
    "[data-embed-load]",
    "[data-copy-markdown-button]",
    "[data-output-copy]",
    "[data-variables-reset]",
    "[data-terminal-copy]",
  ];
  for (const selector of ids) {
    const control = document.querySelector(selector);
    assert.ok(control, `${selector} is in the page`);
    assert.equal(control.hasAttribute("hidden"), true, `${selector} starts hidden`);
  }

  // The ask panel is built by its island; the dialog reserves only a hidden slot for it.
  const ask = document.querySelector("[data-ask-agent]");
  assert.ok(ask, "the dialog reserves a slot for the ask panel");
  assert.equal(ask.hasAttribute("hidden"), true, "the ask slot starts hidden");
  assert.equal(document.querySelector("[data-ask-agent-open]"), null, "no ask row is drawn without the island");
  assert.equal(document.querySelector(".ask-agent-panel"), null, "no prompt panel is drawn without the island");

  // The block action is inert until the island clones it out of the template.
  const template = document.querySelector("template[data-block-actions]") as HTMLTemplateElement | null;
  assert.ok(template);
  assert.equal(template.content.querySelector("[data-block-action]")?.hasAttribute("hidden"), true);
});

test("slow media stays local and makes no provider request until the reader asks", () => {
  assert.equal(all(document, "iframe").length, 0, "no iframe is inserted before a click");
  const imgs = all(document, "img").map((img) => img.getAttribute("src") ?? "");
  assert.deepEqual(imgs, ["/poster.svg"], "the only image is the local poster");
  assert.ok(!imgs.some((src) => /youtube|ytimg|vimeo/i.test(src)));

  const video = document.querySelector("[data-video]");
  assert.ok(video);
  assert.match(video.getAttribute("data-embed") ?? "", /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  assert.match(document.querySelector(".video-link")?.getAttribute("href") ?? "", /^https:\/\/www\.youtube\.com\/watch/);
  assert.equal(document.querySelector(".video-play")?.getAttribute("aria-label"), "Play video: Widget walkthrough");

  const embed = document.querySelector("[data-embed-state]");
  assert.equal(embed?.getAttribute("data-embed-state"), "idle");
  assert.match(document.querySelector(".embed-link")?.getAttribute("href") ?? "", /^https:\/\/www\.youtube\.com\/watch/);
});

test("the diagram is a server-rendered image with its source, not a client render", () => {
  const diagram = document.querySelector("figure.mermaid svg[role='img']");
  assert.ok(diagram);
  assert.equal(diagram.querySelector("title")?.textContent, "The page asks the widget service and receives a response");
  assert.equal(diagram.getAttribute("aria-label"), "The page asks the widget service and receives a response");
  assert.ok(diagram.querySelector("path, g"), "the diagram has drawn content");

  const source = document.querySelector("figure.mermaid script[data-mermaid-record]");
  assert.ok(source, "the source stays on the page for a reader or agent");
  const payload = JSON.parse(source.textContent ?? "{}") as { source?: string; alt?: { text?: string } };
  assert.match(payload.source ?? "", /flowchart LR/);
  assert.equal(payload.alt?.text, "The page asks the widget service and receives a response");
  assert.equal(document.querySelector("script[src*='mermaid']"), null, "the browser never loads Mermaid");
});

test("the Mermaid build cache reuses a render across builds and leaves the output the same", () => {
  const cache = mkdtempSync(join(tmpdir(), "lateen-mermaid-cache-"));
  const first = build("integration", { ...process.env, LATEEN_MERMAID_CACHE_DIR: cache });
  const second = build("integration", { ...process.env, LATEEN_MERMAID_CACHE_DIR: cache });
  try {
    const firstHtml = first.html("/guide/install/");
    const secondHtml = second.html("/guide/install/");
    assert.equal(secondHtml, firstHtml, "a cache hit writes the same page, including the SVG id");
    const files = readdirSync(cache, { recursive: true }).map(String);
    assert.ok(files.some((file) => file.endsWith(".json")), "the cache records an entry");
  } finally {
    rmSync(first.out, { recursive: true, force: true });
    rmSync(second.out, { recursive: true, force: true });
    rmSync(cache, { recursive: true, force: true });
  }
});

test("a failed hydration cannot remove the main content, and the stylesheets keep the no-script layout", () => {
  // jsdom without `runScripts` is the failed-hydration state: the document is parsed, no island runs.
  const text = textOf(document.querySelector("article.doc"));
  assert.ok(text.length > 2_000);
  assert.ok(text.includes("npm install @example/widget"));

  const html = site.html("/guide/install/");
  const firstScript = html.indexOf("<script type=\"module\"");
  assert.ok(firstScript > 0);
  assert.ok(html.indexOf("This guide installs the widget") < firstScript, "content precedes the island scripts");

  const cssHrefs = all(document, "link[rel='stylesheet']").map((link) => link.getAttribute("href") ?? "");
  assert.ok(cssHrefs.length > 0);
  const css = cssHrefs.map((href) => site.file(href.replace(/^\//, ""))).join("\n");
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none/, "hidden panels and controls stay hidden before an island");
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/, "media frames keep their ratio while the player is absent");
});

test("the static Markdown twin carries the same content as the page", () => {
  const markdown = site.file("guide/install/index.md");
  for (const expected of ["This guide installs the widget", "npm install @example/widget", "Finished {{project}} in 340 ms"]) {
    assert.ok(markdown.includes(expected), `the Markdown twin carries ${JSON.stringify(expected)}`);
  }
  assert.equal(document.querySelector(".copy-markdown-link")?.getAttribute("href"), "/guide/install/index.md");
  assert.equal(document.querySelector("[data-copy-markdown-button]")?.getAttribute("data-markdown"), "/guide/install/index.md");
});

test("all island entry points are modules, so a blocked module leaves the document readable", () => {
  const scripts = all(document, "script[type='module']");
  assert.ok(scripts.length > 0);
  for (const script of scripts) assert.ok(script.getAttribute("src")?.startsWith("/assets/theme/islands/"));
  for (const script of all(document, "script:not([src]):not([type])")) {
    assert.match(script.textContent ?? "", /data-theme|prefers-color-scheme/, "the only inline script is the theme's pre-paint choice");
  }
  const data = attrs(document, "script[data-output-evidence]", "type");
  assert.deepEqual(data, ["application/json"]);
});

test("the report components render their tables before any island and ship no client script", () => {
  const reports = site.document("/reports/");
  for (const selector of [".a11y-report table", ".budget-report table", ".wcag-checklist table"]) {
    assert.ok(reports.querySelector(selector), `${selector} is in the server-rendered page`);
  }
  assert.match(textOf(reports.querySelector(".budget-report")), /within the budget/);
  const scripts = all(reports, "script[src]").map((script) => script.getAttribute("src") ?? "");
  assert.ok(!scripts.some((src) => /a11y-report|budget-report|wcag-checklist/.test(src)), "no report component ships an island");
});

test("a brand and its preset preview are in the first paint, before any island", () => {
  const brand = site.document("/brand/");
  const style = brand.querySelector("head style[data-brand]");
  assert.ok(style, "the brand's style is in the head");
  assert.match(style.textContent ?? "", /:root:root \{/);
  assert.match(style.textContent ?? "", /--color-accent: light-dark\(/);
  const preview = brand.querySelector("[data-preset-preview='clay']");
  assert.ok(preview, "the preset sample is server-rendered");
  assert.ok(preview.querySelector(".preset-preview-action"));
  const accent = preview.querySelector("[data-preset-accent]");
  assert.ok(accent, "the accent input is server-rendered");
  const ratio = preview.querySelector("[data-preset-ratio='accent']")?.textContent ?? "";
  assert.match(ratio, /^\d\.\d{2}:1 in light, \d\.\d{2}:1 in dark$/);
  const html = site.html("/brand/");
  assert.ok(html.indexOf("preset-preview") < html.indexOf("type=\"module\""));
});

test("the showpiece page is complete before any island: every section, one h1, (#491)", () => {
  const page = site.document("/showpiece/");
  for (const name of ["hero", "stat-strip", "feature-grid", "frame", "cta-band", "backdrop", "motif"]) {
    assert.equal(all(page, `.${name}`).length, 1, name);
  }
  assert.equal(all(page, "h1").length, 1);
  assert.match(textOf(page.body), /Docs people trust/);
  assert.match(textOf(page.body), /Try it today/);
  const inline = (path: string) => (site.html(path).match(/<script(?![^>]*type="module")[^>]*>/gi) ?? []).length;
  assert.ok(inline("/showpiece/") <= inline("/showpiece-partial/") + 1, "the showpiece adds no inline script of its own");
});

test("the network chrome reads without a script: a disclosure, plain links, and two radio choices", () => {
  const props = {
    site: {
      config: { title: "Alpha", base: "/alpha", lang: "en", dir: "ltr", languages: [], source: ".", theme: { options: {} }, search: { text: 300 } },
      pages: [],
      nav: {},
      data: {},
      collections: {},
      network: {
        current: "alpha",
        lock: "0".repeat(64),
        projects: [
          { id: "alpha", path: "alpha", title: "Alpha", current: true },
          { id: "beta", path: "beta", title: "Beta Docs", current: false },
        ],
      },
    },
    page: { url: "/alpha/", lang: "en", dir: "ltr", title: "Alpha" },
  } as never;

  const switcher = renderToString(projectSwitcher(props) as never);
  assert.match(switcher, /<details class="project-switcher-details"[^>]*><summary class="project-switcher-summary">/);
  assert.equal([...switcher.matchAll(/class="project-switcher-link/g)].length, 2);
  assert.doesNotMatch(switcher, /\shidden[=>]|tabindex="-1"/);

  const mobile = renderToString(mobileProjects(props) as never);
  assert.match(mobile, /<details class="project-switcher-mobile"/);
  assert.equal([...mobile.matchAll(/class="project-switcher-mobile-link/g)].length, 2);

  const footer = renderToString(networkFooter(props) as never);
  assert.match(footer, /<p class="network-footer-label">Projects<\/p>/);
  assert.equal([...footer.matchAll(/class="network-footer-link/g)].length, 2);

  const scope = renderToString(searchScope(props) as never);
  assert.equal([...scope.matchAll(/name="scope"/g)].length, 2);
});
