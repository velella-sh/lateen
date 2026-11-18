import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { all, build, root, textOf, type BuiltSite } from "../integration-helpers.ts";

/**
 * The pinned OpenAPI input: one full operation and one minimal operation, plus the data API
 * published beside it. These tests build the fixture with the installed engine and this theme,
 * then compare every operation page with the input rather than with a stored snapshot.
 */

interface SpecOperation {
  readonly route: string;
  readonly method: string;
  readonly id: string;
  readonly summary?: string;
  readonly parameters: readonly string[];
  readonly statuses: readonly string[];
}

interface SpecPathItem {
  readonly [method: string]: unknown;
}

interface Spec {
  readonly openapi: string;
  readonly info: { readonly title: string; readonly version: string; readonly description?: string };
  readonly paths: Readonly<Record<string, SpecPathItem>>;
}

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const spec = JSON.parse(readFileSync(join(root, "fixtures/api-reference/openapi.json"), "utf8")) as Spec;

/** Every operation in the input, with the parameter names and response statuses it declares. */
const operations: SpecOperation[] = [];
for (const [route, item] of Object.entries(spec.paths)) {
  for (const method of METHODS) {
    const operation = item[method];
    if (!isRecord(operation) || typeof operation.operationId !== "string") continue;
    const parameters = [
      ...(Array.isArray(item.parameters) ? item.parameters : []),
      ...(Array.isArray(operation.parameters) ? operation.parameters : []),
    ]
      .filter(isRecord)
      .map((parameter) => parameter.name)
      .filter((name): name is string => typeof name === "string");
    operations.push({
      route,
      method: method.toUpperCase(),
      id: operation.operationId,
      ...(typeof operation.summary === "string" ? { summary: operation.summary } : {}),
      parameters,
      statuses: isRecord(operation.responses) ? Object.keys(operation.responses) : [],
    });
  }
}

let sharedSite: BuiltSite | undefined;
let sharedBaseSite: BuiltSite | undefined;

/** The fixture built with `base: ""`, once per test run. */
function site(): BuiltSite {
  sharedSite ??= build("api-reference");
  return sharedSite;
}

/** The same fixture with `base: "/docs"`, so every generated link carries the base path. */
function baseSite(): BuiltSite {
  if (sharedBaseSite !== undefined) return sharedBaseSite;
  const config = readFileSync(join(root, "fixtures/api-reference/mizzen.yml"), "utf8");
  const withBase = config.replace('base: ""', 'base: "/docs"');
  assert.notEqual(withBase, config, "the fixture has the root base the base-path test replaces");
  sharedBaseSite = build("api-reference", process.env, { "mizzen.yml": withBase });
  return sharedBaseSite;
}

test("the fixture's operations are the full and minimal sample", () => {
  assert.deepEqual(
    operations.map((operation) => `${operation.method} ${operation.route}`).sort(),
    ["GET /ping", "POST /widgets"],
  );
  assert.deepEqual(operations.find((operation) => operation.id === "createWidget")?.parameters, ["expand"]);
  assert.deepEqual(operations.find((operation) => operation.id === "createWidget")?.statuses, ["201", "422", "500"]);
});

test("the index names the document, its version, its description, and every operation", () => {
  const doc = site().document("/reference/");
  assert.equal(textOf(doc.querySelector("article > h1")), spec.info.title);
  assert.match(textOf(doc.querySelector(".api-reference-index-version")), new RegExp(`Version\\s+${spec.info.version.replace(/\./g, "\\.")}`));
  assert.equal(textOf(doc.querySelector("article > .api-reference-description")), spec.info.description);
  assert.match(textOf(doc.querySelector(".api-reference-index-nav")), /Widgets/);
  assert.match(textOf(doc.querySelector(".api-reference-index-nav")), /Other operations/);
  const links = all(doc, ".api-reference-index-link").map((link) => link.getAttribute("href"));
  for (const operation of operations) assert.ok(links.includes(`/reference/${operation.id}/`), `the index links ${operation.id}`);
});

for (const operation of operations) {
  test(`${operation.method} ${operation.route} has a searchable page that matches the input`, () => {
    const built = site();
    const page = built.document(`/reference/${operation.id}/`);
    assert.equal(textOf(page.querySelector("h1")), operation.summary ?? `${operation.method} ${operation.route}`);
    assert.equal(textOf(page.querySelector(".api-reference-method")), operation.method);
    assert.equal(textOf(page.querySelector(".api-reference-path")), operation.route);

    const rows = all(page, ".api-reference-table tbody tr");
    for (const name of operation.parameters) {
      assert.ok(rows.some((row) => textOf(row.querySelector("td:nth-child(2) code")) === name), `the parameters table names ${name}`);
    }

    const statuses = all(page, ".api-reference-status").map((status) => textOf(status));
    assert.deepEqual(statuses, operation.statuses);

    assert.ok(page.querySelector("article[data-pagefind-body]"), "the operation page is marked for search");
    assert.match(built.file("sitemap.xml"), new RegExp(`/reference/${operation.id}/`), "the operation page is in the sitemap");
    const twin = built.file(`reference/${operation.id}/index.md`);
    assert.ok(twin.includes(`${operation.method} ${operation.route}`), "the Markdown twin carries the operation line");
  });
}

test("the minimal operation still renders its status and description with no optional section", () => {
  const page = site().document("/reference/ping/");
  assert.equal(textOf(page.querySelector(".api-reference-status")), "200");
  assert.match(textOf(page.querySelector(".api-reference-response")), /The service is up\./);
  assert.equal(page.querySelector(".api-reference-table"), null);
  assert.equal(page.querySelectorAll(".api-reference-section").length, 1);
});

test("the data API output still exists beside the reference and is a different document", () => {
  const built = site();
  const index = JSON.parse(built.file("api/v1/index.json")) as { collections: { name: string; json: string }[] };
  assert.equal(index.collections[0]?.name, "books");
  assert.equal(index.collections[0]?.json, "/api/v1/books.json");
  const records = JSON.parse(built.file("api/v1/books.json")) as { records: { title: string }[] };
  assert.equal(records.records[0]?.title, "Widgets at work");
  const api = JSON.parse(built.file("api/v1/openapi.json")) as Spec;
  assert.match(api.openapi, /^3\.1\./);
  assert.match(api.info.title, /data API$/);
  assert.notEqual(api.info.title, spec.info.title);
  assert.equal(api.paths["/widgets"], undefined, "the data API document is not the pinned reference input");
});

test("under a base path the reference and its links carry the base", () => {
  const built = baseSite();
  const index = built.document("/reference/");
  const links = all(index, ".api-reference-index-link").map((link) => link.getAttribute("href"));
  for (const operation of operations) assert.ok(links.includes(`/docs/reference/${operation.id}/`), `the index links ${operation.id} under the base`);

  const page = built.document("/reference/createWidget/");
  assert.equal(textOf(page.querySelector(".api-reference-path")), "/widgets");
  assert.ok(
    all(page, '#site-navigation a[href^="/docs/reference/"]').length > 0,
    "the sidebar links carry the base path",
  );
  assert.match(built.file("sitemap.xml"), /https:\/\/example\.com\/docs\/reference\/createWidget\//);
  const api = JSON.parse(built.file("api/v1/index.json")) as { collections: { json: string }[] };
  assert.equal(api.collections[0]?.json, "/docs/api/v1/books.json");
});
