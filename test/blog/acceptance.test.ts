// The blog, from the built output: post, archive and author URLs, the archive's newest-first
// order, the draft that never appears, the feed, and a second build under a base path. Every
// assertion reads a built file, never the fixture source.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { all, attrs, build, textOf } from "../integration-helpers.ts";

const config = readFileSync(new URL("../../fixtures/blog/mizzen.yml", import.meta.url), "utf8");
const site = build("blog");
const authors = readFileSync(new URL("../../fixtures/blog/_data/authors.yml", import.meta.url), "utf8");
const based = build("blog", {}, {
  "mizzen.yml": config.replace('base: ""', 'base: /blog-docs'),
  "_data/authors.yml": authors.replace("grace:", [
    "  avatar: /portraits/ada.png",
    "  avatarAlt: Portrait of Ada",
    "  url: https://example.org/ada/",
    "grace:",
  ].join("\n")),
});

const titles = (document: Document): string[] =>
  all(document, ".blog-list .blog-item-title a").map((link) => textOf(link));

test("the engine writes a post page, an archive, an author page, and a feed", () => {
  assert.match(site.html("/blog/newer/"), /<h1>A newer post<\/h1>/);
  assert.match(site.html("/blog/archive/"), /<h1>Archive<\/h1>/);
  assert.match(site.html("/blog/authors/ada/"), /<h1>Posts by Ada Lovelace<\/h1>/);
  assert.ok(site.file("blog/feed.xml").includes("<feed"));
});

test("the archive lists the public posts newest first", () => {
  const document = site.document("/blog/archive/");
  assert.deepEqual(titles(document), ["A newer post", "A middle post", "An older post"]);
  assert.deepEqual(attrs(document, ".blog-list time", "datetime"), ["2026-03-10", "2026-02-12", "2026-01-05"]);
});

test("a closed draft gets no page and reaches no archive, author page, or feed", () => {
  assert.ok(!existsSync(join(site.out, "blog/draft/index.html")), "the draft got a page");
  for (const page of ["/blog/archive/", "/blog/authors/ada/", "/blog/newer/", "/"]) {
    assert.ok(!site.html(page).includes("A draft post"), `the draft appears on ${page}`);
  }
  assert.ok(!site.file("blog/feed.xml").includes("A draft post"), "the draft reached the feed");
});

test("an author page shows that author's posts only", () => {
  const document = site.document("/blog/authors/ada/");
  assert.deepEqual(titles(document), ["A newer post", "A middle post"]);
  assert.ok(!textOf(document.body).includes("An older post"), "another author's post appears");
});

test("the feed is newest first and keeps each public post's description", () => {
  const feed = site.file("blog/feed.xml");
  const entries = [...feed.matchAll(/<entry>[\s\S]*?<title>([^<]*)<\/title>[\s\S]*?<\/entry>/g)].map((match) => match[1]);
  assert.deepEqual(entries, ["A newer post", "A middle post", "An older post"]);
  assert.match(feed, /<summary>The newest public post in the fixture\.<\/summary>/);
  assert.match(feed, /<link href="https:\/\/example\.com\/blog\/newer\/"/);
});

test("post links, dates and the archive link work without JavaScript", () => {
  const document = site.document("/blog/newer/");
  const article = document.querySelector("article.post");
  assert.ok(article, "the post article is missing");
  assert.equal(all(article, "h1").length, 1);
  assert.equal(article.querySelector("time")?.getAttribute("datetime"), "2026-03-10");
  assert.equal(article.querySelector(".post-archive")?.getAttribute("href"), "/blog/archive/");
  assert.equal(article.querySelector(".post-author a")?.getAttribute("href"), "/blog/authors/ada/");
  for (const link of all(article, "a")) {
    assert.ok(link.getAttribute("href"), "a post link has no href");
    assert.notEqual(link.getAttribute("tabindex"), "-1", "a post link left the tab order");
  }
});

test("a base path moves the post URLs, archive and author links, and asset links", () => {
  const document = based.document("/blog/newer/");
  assert.equal(document.querySelector(".post-archive")?.getAttribute("href"), "/blog-docs/blog/archive/");
  assert.equal(document.querySelector(".post-author a")?.getAttribute("href"), "/blog-docs/blog/authors/ada/");
  assert.equal(
    based.document("/blog/archive/").querySelector('.blog-item-title a[href="/blog-docs/blog/middle/"]') !== null,
    true,
  );
  const styles = attrs(document, 'link[rel="stylesheet"]', "href");
  assert.ok(styles.length > 0, "the post page loads no stylesheet");
  for (const href of styles) assert.ok(href.startsWith("/blog-docs/"), `stylesheet ${href} ignores the base`);
  assert.match(based.file("blog/feed.xml"), /<link href="https:\/\/example\.com\/blog-docs\/blog\/newer\/"/);
});

test("archives and posts advertise their Atom feed in the head and article", () => {
  for (const [built, base] of [[site, ""], [based, "/blog-docs"]] as const) {
    for (const path of ["/blog/newer/", "/blog/archive/"]) {
      const document = built.document(path);
      const href = `${base}/blog/feed.xml`;
      assert.deepEqual(attrs(document, 'head link[rel="alternate"][type="application/atom+xml"]', "href"), [href]);
      assert.equal(document.querySelector(`main a[type="application/atom+xml"][href="${href}"]`)?.textContent, "Subscribe");
    }
    assert.deepEqual(attrs(built.document("/blog/authors/ada/"), 'head link[type="application/atom+xml"]', "href"), []);
  }
});

test("the author profile precedes the posts and the portrait is also shown in the byline", () => {
  const document = based.document("/blog/authors/ada/");
  const profile = document.querySelector(".blog-author-profile");
  assert.equal(profile?.querySelector("h1")?.textContent, "Posts by Ada Lovelace");
  assert.equal(profile?.querySelector("p")?.textContent, "Writes about engines and the people who build them.");
  assert.equal(profile?.querySelector("a")?.getAttribute("href"), "https://example.org/ada/");
  assert.equal(profile?.querySelector("img")?.getAttribute("src"), "/blog-docs/portraits/ada.png");
  assert.equal(profile?.querySelector("img")?.getAttribute("alt"), "Portrait of Ada");
  assert.ok(profile);
  assert.ok(profile.compareDocumentPosition(document.querySelector(".blog-list")!)
    & document.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING);

  const post = based.document("/blog/newer/");
  assert.equal(post.querySelector(".post-author img")?.getAttribute("src"), "/blog-docs/portraits/ada.png");
  assert.equal(post.querySelector(".post-author-bio"), null);
  assert.equal(site.document("/blog/newer/").querySelector(".post-author-bio")?.textContent, "Writes about engines and the people who build them.");
});
