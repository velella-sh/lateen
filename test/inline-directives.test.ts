import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { all, build, root, type BuiltSite } from "./integration-helpers.ts";

/**
 * Verifies Mizzen's inline text directives (0.2.4) on the theme's components: `:name[label]{key=value}`
 * in the middle of a paragraph must leave phrasing content, in English and in Persian (RTL), and pass
 * axe. A component that draws a block cannot work inline; components/README.md says which, and this
 * test keeps that list true.
 */

/** Inline-safe components, as the directive an author writes in the middle of a sentence. */
const INLINE: Readonly<Record<string, string>> = {
  badge: ":badge[{label}]{variant=tip}",
  kbd: ":kbd[{label}]",
  status: ":status[{label}]{tone=positive}",
  "status (value)": ":status{value=done}",
  term: ":term[Network]{id=network}",
  "term (unknown)": ":term[{label}]",
  symbol: ':symbol[runExample]{signature="runExample(): void" href="/reference/"}',
  "symbol-popover": ":symbol-popover[{label}]{signature=run()}",
  "version-badge": ":version-badge{version=1.2.0 variant=added}",
  "tested-chip": ":tested-chip{passed=3 total=3}",
};

/** Block components people might try inline. They end the paragraph; the README says so. */
const BLOCK: Readonly<Record<string, string>> = {
  tags: ":tags",
  cite: ":cite[{label}]",
  citation: ":citation[{label}]{url=https://example.com/x}",
  "reading-time": ":reading-time[{label}]",
};

const TEXT = {
  en: { before: "Before the directive", after: "after it, and the sentence goes on.", label: "label" },
  fa: { before: "پیش از دستور", after: "پس از آن، و جمله ادامه دارد.", label: "برچسب" },
} as const;
type Lang = keyof typeof TEXT;

function slug(name: string): string {
  return name.replace(/[^a-z]+/g, "-").replace(/-$/, "");
}

function paragraph(lang: Lang, directive: string): string {
  const text = TEXT[lang];
  return `${text.before} ${directive.replaceAll("{label}", text.label)} ${text.after}`;
}

function page(lang: Lang, name: string, directive: string): string {
  return `---\ntitle: ${slug(name)}\nlayout: doc\ntags: [one, two]\n---\n\n# ${slug(name)}\n\n${paragraph(lang, directive)}\n`;
}

const BLOCK_TAGS = new Set(
  "address article aside blockquote details dialog div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr li main menu nav ol p pre section table ul".split(" "),
);
const VOID_TAGS = new Set("area base br col embed hr img input link meta source track wbr".split(" "));

/**
 * Block elements the page's HTML text opens inside a `<p>`. A browser repairs that by ending the
 * paragraph, so the check reads the text the engine wrote, not the repaired DOM.
 */
function blocksInParagraphs(html: string): string[] {
  const body = html.slice(html.indexOf('<div class="doc-body"'));
  const found: string[] = [];
  const stack: string[] = [];
  for (const match of body.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
    const tag = match[2]!.toLowerCase();
    if (VOID_TAGS.has(tag)) continue;
    if (match[1] === "/") {
      const index = stack.lastIndexOf(tag);
      if (index >= 0) stack.length = index;
      continue;
    }
    if (stack.includes("p") && BLOCK_TAGS.has(tag)) found.push(tag);
    stack.push(tag);
  }
  return found;
}

let site: BuiltSite | undefined;
function built(): BuiltSite {
  if (site === undefined) {
    const files: Record<string, string> = {};
    for (const lang of ["en", "fa"] as const) {
      const prefix = lang === "en" ? "" : "fa/";
      for (const [name, directive] of Object.entries({ ...INLINE, ...BLOCK })) {
        files[`${prefix}${slug(name)}.md`] = page(lang, name, directive);
      }
      files[`${prefix}together.md`] = `---\ntitle: Together\nlayout: doc\n---\n\n# Together\n\n${paragraph(
        lang,
        Object.values(INLINE).join(" و "),
      )}\n`;
    }
    site = build("inline-directives", process.env, files);
  }
  return site;
}

const path = (lang: Lang, name: string) => `/${lang === "en" ? "" : "fa/"}${slug(name)}/`;

for (const lang of ["en", "fa"] as const) {
  test(`inline components leave phrasing content in a paragraph (${lang})`, () => {
    for (const name of Object.keys(INLINE)) {
      const html = built().html(path(lang, name));
      assert.deepEqual(blocksInParagraphs(html), [], `${name} (${lang}) opens a block inside <p>`);
      const doc = built().document(path(lang, name));
      const paragraphs = all(doc, ".doc-body > p").filter((p) => p.textContent?.includes(TEXT[lang].after));
      assert.equal(paragraphs.length, 1, `${name} (${lang}) keeps one paragraph around the directive`);
      assert.match(paragraphs[0]!.textContent ?? "", new RegExp(`^${TEXT[lang].before}`), `${name}: text before the directive stays`);
      assert.ok(paragraphs[0]!.children.length > 0, `${name} (${lang}) draws something`);
    }
  });

  test(`every inline component can share one paragraph (${lang})`, () => {
    const html = built().html(path(lang, "together"));
    assert.deepEqual(blocksInParagraphs(html), []);
    const doc = built().document(path(lang, "together"));
    const paragraphs = all(doc, ".doc-body > p");
    assert.equal(paragraphs.length, 1, "one paragraph, no leftovers");
    for (const selector of [".badge", "kbd", ".status", ".term", ".symbol-popover", ".version-badge", ".tested-chip"]) {
      assert.ok(paragraphs[0]!.querySelector(selector) !== null, `${selector} is inside the paragraph`);
    }
  });
}

test("the Persian page is right-to-left and keeps technical text left-to-right", () => {
  const doc = built().document(path("fa", "together"));
  assert.equal(doc.documentElement.getAttribute("dir"), "rtl");
  assert.equal(doc.documentElement.getAttribute("lang"), "fa");
  const paragraph = all(doc, ".doc-body > p")[0]!;
  for (const element of all(paragraph, "[dir=ltr]")) {
    assert.ok(["BDI", "CODE", "A", "SPAN", "KBD"].includes(element.tagName), `${element.tagName} may be forced left-to-right`);
  }
  assert.ok(all(paragraph, "bdi.version-badge-value[dir=ltr]").length === 1, "the version number is isolated");
  assert.match(paragraph.textContent ?? "", /پیش از دستور/);
  // No inline component fixes its own physical side: the page direction places it.
  for (const element of all(paragraph, "[style]")) {
    assert.doesNotMatch(element.getAttribute("style") ?? "", /(margin|padding)-(left|right)|float:|text-align:\s*(left|right)/);
  }
});

test("inline components pass axe in both languages", async () => {
  const axe = createRequire(import.meta.url)("axe-core") as { source: string };
  for (const lang of ["en", "fa"] as const) {
    const dom = new JSDOM(built().html(path(lang, "together")), { runScripts: "outside-only", pretendToBeVisual: true });
    dom.window.eval(axe.source);
    const result = await (
      dom.window as unknown as { axe: { run(context: unknown, options: unknown): Promise<{ violations: { id: string; nodes: { html: string }[] }[] }> } }
    ).axe.run(dom.window.document.querySelector("main"), {
      // jsdom has no layout or paint: contrast and region geometry run in `npm run test:a11y`.
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    assert.deepEqual(
      Array.from(result.violations, (violation) => `${violation.id}: ${violation.nodes[0]?.html.slice(0, 120)}`),
      [],
      `axe on the ${lang} inline page`,
    );
  }
});

test("a block component written inline ends the paragraph, and the README says which ones", () => {
  const readme = readFileSync(join(root, "components", "README.md"), "utf8");
  const section = readme.slice(readme.indexOf("## Inline use"));
  assert.ok(section.length > 0, "components/README.md has an Inline use section");
  for (const name of ["badge", "kbd", "status", "term", "symbol", "symbol-popover", "version-badge", "tested-chip"]) {
    assert.ok(section.includes(`\`${name}\``), `${name} is listed as inline`);
  }
  for (const name of Object.keys(BLOCK)) {
    assert.ok(section.includes(`\`${name}\``), `${name} is listed as a block`);
    assert.ok(blocksInParagraphs(built().html(path("en", name))).length > 0, `${name} is still a block; update the README when it becomes inline-safe`);
  }
});

test("heading-anchor written as a directive fails the build with a clear message", () => {
  assert.throws(
    () => build("inline-directives", process.env, { "bad.md": "---\ntitle: Bad\n---\n\nA :heading-anchor[x] here.\n" }),
    /heading-anchor is not a Markdown directive/,
  );
});
