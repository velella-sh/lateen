import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import apiReference from "../../layouts/api-reference.ts";
import apiReferenceIndex from "../../layouts/api-reference-index.ts";
import { stringsOf } from "../../i18n/index.ts";
import {
  fullOperation,
  heading,
  indexPage,
  layoutProps,
  minimalOperation,
  operationPage,
  pageWith,
} from "./helpers.ts";

const render = (page: Parameters<typeof apiReference>[0]["page"]): string =>
  renderToString(apiReference(layoutProps(page)) as never);
const renderIndex = (page: Parameters<typeof apiReferenceIndex>[0]["page"]): string =>
  renderToString(apiReferenceIndex(layoutProps(page)) as never);

const operationCss = readFileSync(new URL("../../layouts/api-reference.css", import.meta.url), "utf8");
const indexCss = readFileSync(new URL("../../layouts/api-reference-index.css", import.meta.url), "utf8");

test("a full operation renders the method, path, title, description, tags, deprecated state, and server", () => {
  const page = render(operationPage(fullOperation));
  assert.match(page, /<main id="main" tabindex="-1"><article class="doc api-reference" data-pagefind-body="true">/);
  assert.match(page, /<span class="api-reference-method api-reference-method-post">POST<\/span><code class="api-reference-path" dir="ltr">\/widgets<\/code>/);
  assert.match(page, /<h1>Create a widget<\/h1>/);
  assert.match(page, /<p class="api-reference-description">Creates one widget and returns it\.<\/p>/);
  assert.match(page, /<ul class="api-reference-tags" aria-label="Tags"><li class="api-reference-tag">Widgets<\/li><\/ul>/);
  assert.match(page, /<p class="api-reference-deprecated"><span class="api-reference-flag api-reference-flag-caution">Deprecated<\/span><\/p>/);
  assert.match(page, /<span class="api-reference-server-label">Server<\/span> <code dir="ltr">https:\/\/api\.example\.com\/v1<\/code>/);
  assert.equal([...page.matchAll(/<h1>/g)].length, 1);
});

test("the parameters table has one row per parameter, with location, name, type, required state, and description", () => {
  const page = render(operationPage(fullOperation));
  assert.match(page, /<caption class="api-reference-caption">Parameters<\/caption>/);
  assert.match(page, /<th scope="col">In<\/th><th scope="col">Name<\/th><th scope="col">Type<\/th><th scope="col">Required<\/th><th scope="col">Description<\/th>/);
  assert.match(page, /<td><code dir="ltr">query<\/code><\/td><td><code dir="ltr">expand<\/code><\/td><td><code dir="ltr">string<\/code><\/td><td>No<\/td>/);
  assert.match(page, /Related records to include\./);
  assert.match(page, /<td><code dir="ltr">path<\/code><\/td><td><code dir="ltr">id<\/code> <span class="api-reference-flag api-reference-flag-caution">Deprecated<\/span><\/td><td><code dir="ltr">string \(uuid\)<\/code><\/td><td>Yes<\/td>/);
  assert.match(page, /<code dir="ltr">sample<\/code>: <code dir="ltr">w_123<\/code>/);
});

test("the request body shows required state, media type, nested schema properties, and examples", () => {
  const page = render(operationPage(fullOperation));
  assert.match(page, /<h2>Request body <span class="api-reference-flag">Required<\/span><\/h2>/);
  assert.match(page, /<p class="api-reference-description">The widget to create\.<\/p>/);
  assert.match(page, /<h3 class="api-reference-media-type"><code dir="ltr">application\/json<\/code><\/h3>/);
  assert.match(page, /<dt>Type<\/dt><dd><code dir="ltr">object<\/code><\/dd><dt>Required<\/dt><dd><span class="api-reference-code-list"><code dir="ltr">name<\/code><\/span><\/dd>/);
  assert.match(page, /<code dir="ltr">owner<\/code> <span class="api-reference-schema-type" dir="ltr">object<\/span>/);
  assert.match(page, /<code dir="ltr">id<\/code> <span class="api-reference-schema-type" dir="ltr">string \(uuid\)<\/span>/);
  assert.match(page, /<h4 class="api-reference-examples-title">Examples<\/h4>/);
  assert.match(page, /<code class="api-reference-example-name" dir="ltr">minimal<\/code><span class="api-reference-example-summary"> Just a name\.<\/span>/);
  assert.match(page, /&quot;name&quot;: &quot;Gizmo&quot;/);
});

test("responses render every status, its description, content, schemas, and examples", () => {
  const page = render(operationPage(fullOperation));
  assert.match(page, /<h2>Responses<\/h2>/);
  assert.match(page, /<h3><code class="api-reference-status" dir="ltr">201<\/code><span class="api-reference-response-description"> The widget was created\.<\/span><\/h3>/);
  assert.match(page, /<h4 class="api-reference-media-type"><code dir="ltr">application\/json<\/code><\/h4>/);
  assert.match(page, /<h5 class="api-reference-examples-title">Examples<\/h5>/);
  assert.match(page, /<code class="api-reference-example-name" dir="ltr">created<\/code>/);
  assert.match(page, /<h3><code class="api-reference-status" dir="ltr">500<\/code><span class="api-reference-response-description"> The service failed\.<\/span><\/h3>/);
});

test("the minimal operation still has method, path, title, and its response, and no empty optional sections", () => {
  const page = render(operationPage(minimalOperation));
  assert.match(page, /<span class="api-reference-method api-reference-method-get">GET<\/span><code class="api-reference-path" dir="ltr">\/ping<\/code>/);
  assert.match(page, /<h1>GET \/ping<\/h1>/);
  assert.match(page, /<h2>Responses<\/h2><section class="api-reference-response"><h3><code class="api-reference-status" dir="ltr">200<\/code><span class="api-reference-response-description"> The service is up\.<\/span><\/h3>/);
  assert.doesNotMatch(page, /api-reference-tags|api-reference-server|api-reference-deprecated|>Parameters<|>Request body</);
  assert.equal([...page.matchAll(/<h1>/g)].length, 1);
});

test("a page without the operation model falls back to its title and body instead of a blank article", () => {
  const page = render(pageWith({ title: "Hand-written reference", html: "<p>Authored body.</p>", markdown: "Authored body." }));
  assert.match(page, /<article class="doc api-reference" data-pagefind-body="true"><h1>Hand-written reference<\/h1><div class="doc-body"><p>Authored body\.<\/p><\/div>/);
});

test("titles, descriptions, schema text, and example values are escaped", () => {
  const page = render(
    operationPage({
      ...fullOperation,
      title: "Create <b>widget</b>",
      description: "<img src=x onerror=alert(1)>",
      tags: ["<script>"],
      requestBody: {
        required: false,
        content: [
          {
            type: "application/json",
            schema: { type: "object", properties: [{ name: "<meta>", schema: { type: "string" } }] },
            examples: [{ name: "<sample>", value: "<img src=x onerror=alert(1)>" }],
          },
        ],
      },
    }),
  );
  assert.match(page, /<h1>Create &lt;b>widget&lt;\/b><\/h1>/);
  assert.match(page, /&lt;img src=x onerror=alert\(1\)>/);
  assert.doesNotMatch(page, /<img src=x/);
  assert.doesNotMatch(page, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(page, /<meta>/);
});

test("labels come from the page language and every value that must stay left to right says so", () => {
  const page = render(operationPage(fullOperation, { lang: "fa", dir: "rtl" }));
  const persian = stringsOf("fa");
  assert.ok(page.includes(`<h2>${persian.parameters}</h2>`));
  assert.ok(page.includes(persian.api_request_body ?? ""));
  assert.ok(page.includes(persian.api_responses ?? ""));
  assert.ok(page.includes(persian.api_server ?? ""));
  assert.match(page, /<code class="api-reference-path" dir="ltr">\/widgets<\/code>/);
});

test("breadcrumbs, the sidebar, and the on-this-page aside keep their landmarks", () => {
  const nav = [{ title: "Widget API", children: [{ title: "Create a widget", url: "/reference/createWidget/" }] }];
  const trail = [
    { title: "Widget API", url: "/reference/" },
    { title: "Create a widget", url: "/reference/createWidget/" },
  ];
  const page = renderToString(apiReference(layoutProps(operationPage(fullOperation, { headings: [heading(2, "Parameters"), heading(2, "Responses")] }), nav, trail)) as never);
  assert.match(page, /<div class="sidebar" id="site-navigation"><nav class="sidebar-nav"/);
  assert.match(page, /<nav class="breadcrumb" aria-label="Breadcrumbs">/);
  assert.match(page, /<div class="aside"><nav class="toc" aria-labelledby="toc-title">/);
  assert.match(page, /<header class="site-header"/);
});

test("the index renders its title, version, description, groups, and untagged operations", () => {
  const page = renderIndex(
    indexPage({
      title: "Widget API",
      version: "1.4.0",
      description: "A small API.",
      navigation: [
        { title: "Widgets", children: [{ title: "Create a widget", url: "/reference/createWidget/" }] },
        { title: "GET /ping", url: "/reference/ping/" },
      ],
    }),
  );
  assert.match(page, /<article class="doc api-reference-index" data-pagefind-body="true">/);
  assert.match(page, /<h1>Widget API<\/h1>/);
  assert.match(page, /<span class="api-reference-index-label">Version<\/span> <code dir="ltr">1\.4\.0<\/code>/);
  assert.match(page, /<p class="api-reference-description">A small API\.<\/p>/);
  assert.match(page, /<nav class="api-reference-index-nav" aria-labelledby="api-reference-index-nav-title"><h2 id="api-reference-index-nav-title">Operations<\/h2>/);
  assert.match(page, /<h3 class="api-reference-index-group-title">Widgets<\/h3><ul class="api-reference-index-list"><li><a class="api-reference-index-link" href="\/reference\/createWidget\/">Create a widget<\/a><\/li><\/ul>/);
  assert.match(page, /<h3 class="api-reference-index-group-title">Other operations<\/h3><ul class="api-reference-index-list"><li><a class="api-reference-index-link" href="\/reference\/ping\/">GET \/ping<\/a><\/li><\/ul>/);
  assert.equal([...page.matchAll(/<h1>/g)].length, 1);
});

test("an index without the engine model falls back to its title and body", () => {
  const page = renderIndex(pageWith({ title: "Reference", html: "<p>Authored.</p>" }));
  assert.match(page, /<h1>Reference<\/h1><div class="doc-body"><p>Authored\.<\/p><\/div>/);
});

test("the index uses the page language and leaves out the nav when the model has no entries", () => {
  const persian = stringsOf("fa");
  const page = renderIndex(
    indexPage({ title: "ویجت", version: "۱", navigation: [] }, { lang: "fa", dir: "rtl", title: "ویجت" }),
  );
  assert.ok(page.includes(`<span class="api-reference-index-label">${persian.api_version}</span>`));
  assert.doesNotMatch(page, /api-reference-index-nav/);
});

test("the stylesheets use logical properties and only tokens that exist", () => {
  const physical = [
    /\b(margin|padding|border|scroll-margin|scroll-padding)-(left|right|top|bottom)\b/,
    /\bborder-(top|bottom)-(left|right)-radius\b/,
    /(^|[;{\s])(left|right|top|bottom)\s*:/,
    /\btext-align\s*:\s*(left|right)\b/,
    /\bfloat\s*:\s*(left|right)\b/,
  ];
  for (const css of [operationCss, indexCss]) {
    const lines = css
      .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
      .split("\n")
      .filter((line) => !/^\s*@(media|container|supports)/.test(line))
      .filter((line) => physical.some((rule) => rule.test(line)))
      .map((line) => line.trim());
    assert.deepEqual(lines, []);
  }
});
