// The mono family is the one shipped face a page rarely needs before its first paint: prose, headings,
// links, and inline code all render in the text face, so a page with no code block asks the engine to
// leave the mono preload out and saves two font requests. A page that does render a block keeps it,
// because its code is first paint. The stylesheet still declares the face either way, so nothing the
// page draws changes: only the preload link and the request it starts are left out.
import assert from "node:assert/strict";
import { test } from "node:test";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import base, { MAIN_ID } from "../layouts/base.ts";

const pos: SourcePos = { file: "docs/index.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config: SiteConfig = {
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
};

function props(html: string, overrides: Partial<Page> = {}): LayoutProps {
  const page: Page = {
    url: "/",
    source: pos,
    frontMatter: {},
    title: "Page",
    lang: "en",
    dir: "ltr",
    headings: [],
    html,
    markdown: "",
    kind: "doc",
    ...overrides,
  };
  const site: Site = { config, pages: [page], nav: {}, data: {}, collections: {} };
  return {
    site,
    page,
    trail: [],
    pager: {},
    head: { title: "Page · Example", meta: [], links: [], jsonLd: [] },
    islands: [],
  };
}

const MONO = "JetBrains Mono";

/** Collects the families the layout asks the engine not to preload, once each as the engine does. */
function skipping(input: LayoutProps): string[] {
  const families: string[] = [];
  renderToString(
    h(base, {
      ...input,
      hints: {
        skipFontPreload: (family: string) => {
          if (!families.includes(family)) families.push(family);
        },
      },
    }),
  );
  return families;
}

test("a page body with no code block asks to skip the mono preload", () => {
  assert.deepEqual(skipping(props("<p>Prose only.</p>")), ["Vazirmatn", MONO]);
  assert.deepEqual(skipping(props("<h2>Heading</h2><p><a href=\"/x/\">Link</a></p>")), ["Vazirmatn", MONO]);
});

test("inline code is not a reason to preload the mono face", () => {
  assert.deepEqual(skipping(props("<p>Run <code>npm install</code> first.</p>")), ["Vazirmatn", MONO]);
  assert.deepEqual(skipping(props("<p><kbd>⌘</kbd><kbd>K</kbd> opens search.</p>")), ["Vazirmatn", MONO]);
});

test("a page body with a code block keeps the mono preload", () => {
  assert.deepEqual(skipping(props("<pre><code>npm install</code></pre>")), ["Vazirmatn"]);
  assert.deepEqual(skipping(props("<p>Then:</p><pre class=\"language-sh\" tabindex=\"0\"><code>x</code></pre>")), ["Vazirmatn"]);
});

test("the block test is case-insensitive and matches only the element name", () => {
  assert.deepEqual(skipping(props("<PRE><code>x</code></PRE>")), ["Vazirmatn"], "uppercase <pre> still counts");
  assert.deepEqual(skipping(props("<p><prefix-element></prefix-element> Usage.</p>")), ["Vazirmatn", MONO], "<prefix> is not a block");
  assert.deepEqual(skipping(props("<p>A &lt;pre&gt; in prose, escaped.</p>")), ["Vazirmatn", MONO], "escaped text is not a block");
});

test("an RTL page without a code block skips its other script's face and the mono family", () => {
  assert.deepEqual(skipping(props("<p>متن.</p>", { lang: "fa", dir: "rtl" })), ["Manrope", MONO]);
  assert.deepEqual(skipping(props("<pre><code>x</code></pre>", { lang: "fa", dir: "rtl" })), ["Manrope"]);
});

test("a brand that replaces the mono family skips it once, with or without a code block", () => {
  const withBrand = (html: string): string[] => {
    const input = props(html);
    const branded: LayoutProps = {
      ...input,
      site: {
        ...input.site,
        config: {
          ...config,
          theme: { options: { brand: { fonts: { mono: { family: "Example Mono", files: [{ src: "/fonts/mono.woff2", weight: 400 }] } } } } },
        },
      },
    };
    return skipping(branded);
  };
  assert.deepEqual(withBrand("<p>Prose only.</p>"), ["Vazirmatn", MONO], "asked for once");
  assert.deepEqual(withBrand("<pre><code>x</code></pre>"), ["Vazirmatn", MONO]);
});

test("a page with no hint collector renders exactly as before", () => {
  const plain = renderToString(h(base, props("<p>Prose only.</p>")));
  assert.doesNotMatch(plain, /<link rel="preload"/, "preloads are the engine's, added after the layout renders");
  assert.match(plain, new RegExp(`<main id="${MAIN_ID}"`));
});
