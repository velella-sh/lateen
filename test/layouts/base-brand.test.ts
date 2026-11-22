// The base layout is where a brand reaches the page: one server-rendered <style> element after the
// head's links, no inline style attribute anywhere, nothing when the site sets no brand, and a CSS
// comment naming any value that was ignored. Two renders of the same options are the same HTML.
import assert from "node:assert/strict";
import { test } from "node:test";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import base from "../../layouts/base.ts";

const pos: SourcePos = { file: "docs/index.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

function configWith(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    title: "Example",
    base: "",
    lang: "en",
    dir: "ltr",
    languages: [],
    source: ".",
    include: [],
    exclude: [],
    navigation: "_data/navigation.yml",
    defaults: [],
    theme: { options: {} },
    search: { text: 300 },
    redirects: {},
    outputs: {},
    collections: {},
    feeds: {},
    ...overrides,
  };
}

function layoutProps(config: SiteConfig = configWith(), hints?: LayoutProps["hints"]): LayoutProps {
  const page: Page = {
    url: "/",
    source: pos,
    frontMatter: {},
    title: "Home",
    lang: "en",
    dir: "ltr",
    headings: [],
    // A code block, so the page preloads both shipped families and only a brand can remove one;
    // the layout-base-code-preload test holds the no-code rule.
    html: "<p>Body</p><pre><code>code</code></pre>",
    markdown: "",
    kind: "doc",
  };
  const site: Site = { config, pages: [page], nav: {}, data: {}, collections: {} };
  return {
    site,
    page,
    trail: [],
    pager: {},
    head: { title: "Home · Example", meta: [], links: [], jsonLd: [] },
    islands: [],
    ...(hints === undefined ? {} : { hints }),
  };
}

const render = (config?: SiteConfig, hints?: LayoutProps["hints"]): string =>
  renderToString(h(base, layoutProps(config, hints)));

/** Collects the families the layout asks the engine not to preload. */
const skipping = (): { readonly families: string[]; readonly hints: LayoutProps["hints"] } => {
  const families: string[] = [];
  return { families, hints: { skipFontPreload: (family: string) => families.push(family) } };
};

test("a brand writes one style element inside the head, after the title", () => {
  const html = render(configWith({ theme: { options: { preset: "harbor" } } }));
  assert.equal(html.match(/<style/g)?.length, 1);
  assert.match(html, /<style data-brand="true">/);
  assert.match(html, /:root:root \{/);
  assert.match(html, /--color-accent: light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\);/);
  assert.match(html, /--radius-md: 0.5rem;/);
  assert.ok(html.indexOf('<style data-brand="true">') > html.indexOf("<title>"));
  assert.ok(html.indexOf('<style data-brand="true">') < html.indexOf("</head>"));
});

test("the brand writes no style attribute on any element", () => {
  const html = render(configWith({ theme: { options: { preset: "clay" } } }));
  assert.doesNotMatch(html, / style="/);
});

test("a site without a brand produces the same head as before", () => {
  const plain = render();
  assert.doesNotMatch(plain, /<style/);
  assert.equal(render(configWith()), plain);
  assert.equal(render(configWith({ theme: { options: { anUnreadOption: true } } })), plain);
});

test("an ignored value leaves a comment that names the option", () => {
  const html = render(configWith({ theme: { options: { brand: { accent: "green" } } } }));
  assert.match(html, /\/\* lateen: ignored theme\.options\.brand\.accent: is not a #rgb or #rrggbb colour \*\//);
  assert.doesNotMatch(html, /--color-accent/);
  assert.doesNotMatch(html, /:root:root/);
});

test("an unknown preset is a visible comment, not a failed build", () => {
  const html = render(configWith({ theme: { options: { preset: "midnight" } } }));
  assert.match(html, /\/\* lateen: ignored theme\.options\.preset: unknown preset "midnight" \*\//);
});

test("the same options render the same bytes twice", () => {
  const config = configWith({ theme: { options: { preset: "graphite", brand: { accent: "#123456" } } } });
  assert.equal(render(config), render(config));
});

test("custom fonts are requested through the site base", () => {
  const html = render(
    configWith({
      base: "/lateen",
      theme: {
        options: {
          brand: {
            fonts: {
              sans: { family: "Example Sans", files: [{ src: "/fonts/example-sans-400.woff2", weight: 400 }] },
            },
          },
        },
      },
    }),
  );
  assert.match(html, /@font-face \{ font-family: "Example Sans";/);
  assert.match(html, /url\("\/lateen\/fonts\/example-sans-400\.woff2"\)/);
  assert.match(html, /--type-font-body: "Example Sans", Manrope,/);
});

const sans = { family: "Example Sans", files: [{ src: "/fonts/sans.woff2", weight: 400 }] };
const mono = { family: "Example Mono", files: [{ src: "/fonts/mono.woff2", weight: 400 }] };

test("a replaced sans or mono family asks the engine to leave its preload out, independently", () => {
  const onlySans = skipping();
  render(configWith({ theme: { options: { brand: { fonts: { sans } } } } }), onlySans.hints);
  assert.deepEqual(onlySans.families, ["Vazirmatn", "Manrope"]);

  const onlyMono = skipping();
  render(configWith({ theme: { options: { brand: { fonts: { mono } } } } }), onlyMono.hints);
  assert.deepEqual(onlyMono.families, ["Vazirmatn", "JetBrains Mono"]);

  const both = skipping();
  render(configWith({ theme: { options: { brand: { fonts: { sans, mono } } } } }), both.hints);
  assert.deepEqual(both.families, ["Vazirmatn", "Manrope", "JetBrains Mono"]);
});

test("a site without custom fonts asks for no preload change", () => {
  for (const options of [{}, { preset: "harbor" }, { brand: { accent: "#2f6f9f", radius: "large" } }]) {
    const skipped = skipping();
    render(configWith({ theme: { options } }), skipped.hints);
    assert.deepEqual(skipped.families, ["Vazirmatn"], JSON.stringify(options));
  }
});
