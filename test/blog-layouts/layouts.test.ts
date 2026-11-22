import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import list from "../../layouts/list.ts";
import post from "../../layouts/post.ts";

const pos: SourcePos = { file: "posts/newer.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const authors = {
  ada: { name: "Ada Lovelace", bio: "Writes about engines." },
  grace: { name: "Grace Hopper" },
};

const config = {
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
  blog: { posts: "posts", route: "blog", archive: "archive", authors: true, feed: true },
} as unknown as SiteConfig;

const newer = { title: "A newer post", date: "2026-03-10", author: "ada", url: "/blog/newer/", description: "The newest one." };
const older = { title: "An older post", date: "2026-01-05", author: "grace", url: "/blog/older/" };

function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    url: "/blog/newer/",
    source: pos,
    frontMatter: { ...newer, blog: { kind: "post" } },
    title: newer.title,
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "<p>The post body.</p>",
    markdown: "The post body.",
    kind: "doc",
    ...overrides,
  } as Page;
}

const archivePage = pageWith({
  url: "/blog/archive/",
  frontMatter: { title: "Archive", layout: "list", blog: { kind: "archive", posts: [newer, older] } },
  title: "Archive",
});

const authorPage = pageWith({
  url: "/blog/authors/ada/",
  frontMatter: {
    title: authors.ada.name,
    layout: "list",
    blog: { kind: "author", author: { id: "ada", ...authors.ada }, posts: [newer] },
  },
  title: authors.ada.name,
});

function propsOf(page: Page, base = ""): LayoutProps {
  const siteConfig = { ...config, base } as SiteConfig;
  // A real build writes base into every page URL; match it so a link test sees the same URLs.
  const withBase = (target: Page): Page => (base === "" ? target : { ...target, url: `${base}${target.url}` });
  const site: Site = {
    config: siteConfig,
    pages: [withBase(page), withBase(archivePage), withBase(authorPage)],
    nav: { main: [] },
    data: { authors },
    collections: {},
  };
  return {
    site,
    page,
    trail: [{ title: page.title, url: page.url }],
    pager: {},
    head: { title: `${page.title} · Example`, meta: [], links: [], jsonLd: [] },
    islands: [],
  } as unknown as LayoutProps;
}

const renderPost = (page: Page, base = "") => renderToString(post(propsOf(page, base)) as never);
const renderList = (page: Page, base = "") => renderToString(list(propsOf(page, base)) as never);

test("a post shows one title, its date, author name, description and highlighted body", () => {
  const out = renderPost(
    pageWith({
      html: '<pre><code class="language-js">const answer = 42;</code></pre>',
    }),
  );
  assert.equal((out.match(/<h1>/g) ?? []).length, 1);
  assert.match(out, /<h1>A newer post<\/h1>/);
  assert.match(out, /<time datetime="2026-03-10">10 March 2026<\/time>/);
  assert.match(out, /Ada Lovelace/);
  assert.match(out, /<p class="post-description">The newest one.<\/p>/);
  assert.match(out, /<a class="post-archive" href="\/blog\/archive\/">Back to the archive<\/a>/);
  assert.match(out, /<div class="doc-body"><pre class="code"/);
  assert.ok(out.replace(/<[^>]*>/g, "").includes("const answer = 42;"), "the highlighted body lost its code");
  assert.match(out, /--shiki-light/, "the fence was not highlighted");
});

test("a post whose body has an h1 does not repeat the title", () => {
  const out = renderPost(pageWith({ headings: [{ depth: 1, text: "Body title", id: "body-title", pos }] }));
  assert.equal((out.match(/<h1>/g) ?? []).length, 0);
  assert.ok(!out.includes(">A newer post<"));
});

test("a post under a base path links the archive and a real author page with the base", () => {
  const out = renderPost(pageWith(), "/blog-docs");
  assert.match(out, /href="\/blog-docs\/blog\/archive\/"/);
  assert.match(out, /href="\/blog-docs\/blog\/authors\/ada\/"/);
});

test("an archive lists the posts in the engine's newest-first order, without a record table", () => {
  const out = renderList(archivePage);
  assert.match(out, /<h1>Archive<\/h1>/);
  assert.ok(out.indexOf("/blog/newer/") < out.indexOf("/blog/older/"), "the archive reordered the posts");
  assert.match(out, /<time datetime="2026-03-10">10 March 2026<\/time>/);
  assert.match(out, /<p class="blog-description">The newest one.<\/p>/);
  assert.match(out, /Grace Hopper/);
  assert.ok(!out.includes("<table"), "a blog page must not render the empty records table");
});

test("an author page has a localized heading and only that author's posts", () => {
  const out = renderList(authorPage);
  assert.match(out, /<h1>Posts by Ada Lovelace<\/h1>/);
  assert.match(out, /href="\/blog\/newer\/"/);
  assert.ok(!out.includes("/blog/older/"), "an author page listed another author's post");
});

test("an empty blog page says so instead of drawing an empty list", () => {
  const empty = pageWith({
    url: "/blog/authors/ada/",
    frontMatter: { title: "Ada", layout: "list", blog: { kind: "author", author: { id: "ada", name: "Ada Lovelace" }, posts: [] } },
  });
  const out = renderList(empty);
  assert.match(out, /<p class="list-empty">No posts yet.<\/p>/);
  assert.ok(!out.includes("<ul"), "an empty blog page rendered a list");
});

test("every blog link is a plain keyboard-focusable anchor", () => {
  for (const out of [renderPost(pageWith()), renderList(archivePage), renderList(authorPage)]) {
    for (const tag of out.match(/<a\b[^>]*>/g) ?? []) {
      if (/\shidden(?:\s|>)/.test(tag)) continue;
      assert.match(tag, /\shref="[^"]+"/, `an anchor has no href: ${tag}`);
      assert.doesNotMatch(tag, /tabindex="-1"/, `an anchor is removed from the tab order: ${tag}`);
      assert.doesNotMatch(tag, /\sonclick=/, `an anchor needs JavaScript: ${tag}`);
    }
  }
});

test("blog links appear only for a published feed and reuse an existing Atom alternate", () => {
  const props = propsOf(pageWith());
  const url = "https://example.com";
  const href = "/blog/feed.xml";
  const site = { ...props.site, config: { ...props.site.config, url } };
  const head = { ...props.head, links: [{ rel: "alternate", href: url + href, attrs: { type: "application/atom+xml" } }] };
  const out = renderToString(post({ ...props, site, head }) as never);
  assert.equal((out.match(/<link[^>]+application\/atom\+xml/g) ?? []).length, 1);
  assert.match(out, /<a class="list-feed-link" href="\/blog\/feed.xml"/);
  for (const withoutFeed of [
    props.site,
    { ...site, pages: [] },
    { ...site, config: { ...site.config, outputs: { "blog-feed": false } } },
    { ...site, config: { ...site.config, blog: { ...site.config.blog!, feed: false } } },
  ]) {
    assert.doesNotMatch(renderToString(post({ ...props, site: withoutFeed }) as never), /blog\/feed.xml/);
  }
});

test("an RTL author profile accepts image and falls back to the author's name for its alt", () => {
  const author = { id: "ada", name: "آدا", image: "https://example.org/portrait.jpg", url: "javascript:alert(1)" };
  const html = renderList(pageWith({
    ...authorPage,
    lang: "fa",
    dir: "rtl",
    frontMatter: { blog: { kind: "author", author, posts: [newer] } },
  }));
  assert.match(html, /<h1>نوشته‌های آدا<\/h1>/);
  assert.match(html, /src="https:\/\/example\.org\/portrait\.jpg" alt="آدا"/);
  assert.doesNotMatch(html, /href="javascript:/);
});
