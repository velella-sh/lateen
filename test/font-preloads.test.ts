// A page preloads only the font family it draws its first paint with. Sans is replaced when a site
// brings its own, and the other script's face is left to the glyphs that need it; both rules live in
// the base layout. The mono family follows the page instead of the site: a page body with a code block
// preloads it, and a page without one does not, since prose, headings, links, and inline code render
// in the text face. The engine still declares every shipped face in the stylesheet, so nothing a page
// draws changes; only the preload link and the request it starts are left out. These fixtures differ
// only in their brand, and the extra pages differ only in whether they carry a block.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { build, type BuiltSite } from "./integration-helpers.ts";

/** The preload URLs a built page asks for, in document order. */
const preloads = (html: string): string[] =>
  [...html.matchAll(/<link rel="preload" as="font"[^>]*href="([^"]+)"/g)].map((match) => match[1] ?? "");

const sans = (url: string): boolean => /\/fonts\/manrope\/[^/]+\.woff2$/.test(url);
const mono = (url: string): boolean => /\/fonts\/jetbrains-mono\/[^/]+\.woff2$/.test(url);
const vazir = (url: string): boolean => /\/fonts\/vazirmatn\/[^/]+\.woff2$/.test(url);

/** A page with a fenced code block, which the build renders as `<pre>`. */
const CODE_PAGE = "# Code\n\n```sh\nnpm install\n```\n";

/** Builds one fixture with any extra pages, hands it to `read`, and removes the output. */
function withSite<T>(name: string, files: Readonly<Record<string, string>>, read: (site: BuiltSite) => T): T {
  const site = build(name, process.env, files);
  try {
    return read(site);
  } finally {
    rmSync(site.out, { recursive: true, force: true });
  }
}

/** The stylesheet URLs a built page links, so a test can read what the page declares. */
const stylesheets = (html: string): string[] =>
  [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => match[1] ?? "");

test("a page with a code block preloads both shipped families", () => {
  withSite("fonts-default", { "code.md": `---\ntitle: Code\nlayout: doc\n---\n\n${CODE_PAGE}` }, (site) => {
    const urls = preloads(site.html("/code/"));
    assert.equal(urls.filter(sans).length, 3, "three sans weights are preloaded");
    assert.equal(urls.filter(mono).length, 2, "two mono weights are preloaded for the block");
  });
});

test("a page with no code block preloads only the text family, and still declares the mono face", () => {
  withSite("fonts-default", {}, (site) => {
    const html = site.html("/");
    const urls = preloads(html);
    assert.equal(urls.filter(sans).length, 3, "three sans weights are preloaded");
    assert.equal(urls.filter(mono).length, 0, "no mono preload without a block");
    assert.equal(new Set(urls).size, urls.length, "no font is preloaded twice");
    const declared = stylesheets(html).map((href) => site.file(href.replace(/^\//, ""))).join("\n");
    assert.match(declared, /font-family: ?"?JetBrains Mono/, "the mono face stays declared for inline code");
  });
});

test("the standard landing page preloads only the sans family", () => {
  withSite("fonts-default", { "landing.md": "---\ntitle: Landing\nlayout: home\n---\n\nLanding copy.\n" }, (site) => {
    const urls = preloads(site.html("/landing/"));
    assert.equal(urls.filter(sans).length, 3);
    assert.equal(urls.filter(mono).length, 0);
  });
});

test("an RTL page preloads its own script's family first and leaves out the Latin face", () => {
  const files = {
    "fa/index.md": "---\ntitle: صفحه\nlang: fa\ndir: rtl\n---\n\nمتن.",
    "ar/index.md": "---\ntitle: صفحة\nlang: ar\ndir: rtl\n---\n\nنص.",
    "fa/code.md": `---\ntitle: کد\nlang: fa\ndir: rtl\n---\n\n${CODE_PAGE}`,
  };
  withSite("fonts-default", files, (site) => {
    const en = preloads(site.html("/"));
    assert.equal(en.filter(sans).length, 3, "the LTR page preloads three Manrope weights");
    assert.equal(en.filter(mono).length, 0, "a prose page preloads no mono face");
    assert.equal(en.filter(vazir).length, 0, "the LTR page leaves out Vazirmatn");
    assert.ok(sans(en[0] ?? ""), "the LTR page leads with Manrope");

    for (const path of ["/fa/", "/ar/"]) {
      const urls = preloads(site.html(path));
      assert.equal(urls.filter(vazir).length, 3, `${path} preloads three Vazirmatn weights`);
      assert.equal(urls.filter(mono).length, 0, `${path} preloads no mono face without a block`);
      assert.equal(urls.filter(sans).length, 0, `${path} leaves out Manrope`);
      assert.ok(vazir(urls[0] ?? ""), `${path} leads with Vazirmatn`);
    }

    const rtlCode = preloads(site.html("/fa/code/"));
    assert.equal(rtlCode.filter(vazir).length, 3, "an RTL code page keeps its own script's family");
    assert.equal(rtlCode.filter(mono).length, 2, "an RTL code page keeps the shared mono preloads");
    assert.equal(rtlCode.filter(sans).length, 0, "an RTL code page leaves out Manrope");
    assert.ok(vazir(rtlCode[0] ?? ""), "the RTL code page leads with Vazirmatn");
  });
});

test("a custom sans family leaves out only the sans preloads", () => {
  withSite("fonts-sans", { "code.md": `---\ntitle: Code\nlayout: doc\n---\n\n${CODE_PAGE}` }, (site) => {
    const html = site.html("/code/");
    const urls = preloads(html);
    assert.equal(urls.filter(sans).length, 0);
    assert.equal(urls.filter(mono).length, 2, "the mono family was not replaced");
    assert.match(html, /@font-face \{ font-family: "Example Sans";/);
    assert.match(html, /--type-font-body: "Example Sans", Manrope, "Manrope Fallback", Vazirmatn,/);
  });
});

test("a custom mono family leaves out only the mono preloads", () => {
  withSite("fonts-mono", { "code.md": `---\ntitle: Code\nlayout: doc\n---\n\n${CODE_PAGE}` }, (site) => {
    const html = site.html("/code/");
    const urls = preloads(html);
    assert.equal(urls.filter(sans).length, 3, "the sans family was not replaced");
    assert.equal(urls.filter(mono).length, 0);
    assert.match(html, /@font-face \{ font-family: "Example Mono";/);
    assert.match(html, /--type-font-mono: "Example Mono", JetBrains Mono, "JetBrains Mono Fallback", ui-monospace, monospace;/);
  });
});

test("custom sans and mono families leave out both shipped preloads and keep both fallbacks", () => {
  withSite("fonts-both", { "code.md": `---\ntitle: Code\nlayout: doc\n---\n\n${CODE_PAGE}` }, (site) => {
    for (const path of ["/", "/code/"]) {
      const html = site.html(path);
      const urls = preloads(html);
      assert.equal(urls.filter(sans).length, 0, `${path}: no shipped sans`);
      assert.equal(urls.filter(mono).length, 0, `${path}: no shipped mono`);
      assert.doesNotMatch(html, /<link rel="preload" as="font"/, `${path}: no shipped font is preloaded`);
      assert.match(html, /@font-face \{ font-family: "Example Sans";/);
      assert.match(html, /@font-face \{ font-family: "Example Mono";/);
      assert.match(html, /--type-font-body: "Example Sans", Manrope, "Manrope Fallback", Vazirmatn,/);
      assert.match(html, /--type-font-mono: "Example Mono", JetBrains Mono, "JetBrains Mono Fallback", ui-monospace, monospace;/);
    }
  });
});
