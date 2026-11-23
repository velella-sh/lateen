import assert from "node:assert/strict";
import { test } from "node:test";
import { revealApiSchema } from "../components/collection-api-schema/client.ts";
import { attrs, build, dataSite, type BuiltSite } from "./integration-helpers.ts";

const links = (site: BuiltSite, path: string) =>
  attrs(site.document(path), 'section[aria-labelledby="collection-api"] a[href]', "href");

const config = `
title: API catalogue
url: https://catalogue.example
collections:
  components:
    source: _data/components.yml
    id: slug
    template: _templates/components.md
    permalink: /components/item-{slug}/
    public: [name, slug]
    schema: component-schema.json
    lifecycle:
      field: status
      retired: [deprecated]
  releases:
    source: _data/releases.json
    template: _templates/releases.md
    permalink: /releases/{id}/
  regions:
    source: _data/regions.csv
    template: _templates/regions.md
    permalink: /regions/{id}/
    schema: region-schema.json
api:
  version: v2
  collections:
    components: { fields: [name] }
  versions:
    v10:
      collections:
        components: { fields: [name], id: slug }
    v11:
      deprecated: true
      sunset: "2030-01-01"
      successor: v10
      collections:
        components: { fields: [name] }
        regions: { fields: [code] }
`;

const files = {
  ...Object.fromEntries(["components", "regions", "releases"].map((name) => [
    `${name}.md`,
    `---\ntitle: ${name}\nlayout: list\nlist:\n  collection: ${name}\n---\n`,
  ])),
  "_templates/components.md": "---\ntitle: '{name}'\nlayout: record\n---\n\n# :field[name]\n",
  "component-schema.json": JSON.stringify({ type: "object", properties: {
    name: { type: "string" },
    status: { type: "string" },
  } }),
  "region-schema.json": "true",
};

test("record and list pages link to their collection's newest active API files under the site base", async () => {
  const base = "/api";
  const site = build("data-site", process.env, { ...files, "mizzen.yml": `${config}\nbase: ${base}\n` });
  const version = `${base}/api/v10`;
  const record = `${version}/components/button.json`;
  assert.deepEqual(links(site, "/components/item-button/"), [record]);
  const targets = links(site, "/components/");
  assert.deepEqual(targets, ["components.json", "components.ndjson", "openapi.json"]
    .map((path) => `${version}/${path}`));
  for (const target of [record, ...targets]) assert.ok(site.file(target.slice(base.length + 1)));

  const payload = JSON.parse(site.file("api/v10/components/button.json"));
  assert.deepEqual(payload.fields, { name: "Button" });
  assert.equal(payload.slug, "button");
  const schema = JSON.parse(site.file("api/v10/schemas/components.json"));
  assert.deepEqual(Object.keys(schema.properties), ["slug", "name"]);

  const componentList = site.document("/components/");
  const island = "assets/theme/islands/components/collection-api-schema/client.js";
  assert.ok(componentList.querySelector(`script[src="${base}/${island}"]`));
  assert.match(site.file(island), /revealApiSchema/);
  assert.equal(site.document("/components/item-button/").querySelector(`script[src="${base}/${island}"]`), null);
  await revealApiSchema(componentList, async (url) => {
    assert.equal(url, `${version}/index.json`);
    return new Response(site.file("api/v10/index.json"));
  });
  assert.equal(componentList.querySelector('[data-api-schema]:not([hidden]) a')?.getAttribute("href"),
    `${version}/schemas/components.json`);

  assert.deepEqual(links(site, "/components/item-sidebar/"), [], "retired record excluded by the API");
  assert.deepEqual(links(site, "/releases/"), [], "unpublished collection");
  assert.deepEqual(links(site, "/releases/4.0.0/"), [], "record in an unpublished collection");

  assert.deepEqual(links(site, "/regions/"), ["regions.json", "regions.ndjson", "openapi.json"]
    .map((path) => `${base}/api/v11/${path}`));
  assert.match(site.document("/regions/").getElementById("collection-api")?.textContent ?? "", /v11 \(Deprecated\)/);
  assert.deepEqual(links(site, "/regions/north/"), [`${base}/api/v11/regions/north.json`]);
  const regionList = site.document("/regions/");
  const regionIndex = site.file("api/v11/index.json");
  assert.equal(JSON.parse(regionIndex).collections.find(({ name }: { name: string }) => name === "regions")?.schema, null);
  assert.throws(() => site.file("api/v11/schemas/regions.json"), { code: "ENOENT" });
  await revealApiSchema(regionList, async () => new Response(regionIndex));
  assert.ok(regionList.querySelector("[data-api-schema][hidden]"));
  assert.equal(regionList.querySelector("[data-api-schema] a[href]"), null);
});

test("a root deployment links to /api and an output override suppresses the links", () => {
  const site = build("data-site", process.env, { ...files, "mizzen.yml": `${config}\nlang: fa\n` });
  assert.deepEqual(links(site, "/components/item-button/"), ["/api/v10/components/button.json"]);
  assert.match(site.document("/components/").getElementById("collection-api")?.textContent ?? "", /رابط برنامه‌نویسی داده‌ها/);

  const disabled = build("data-site", process.env, { ...files, "mizzen.yml": `${config}\noutputs: { api: false }\n` });
  assert.deepEqual(links(disabled, "/components/"), []);
  assert.deepEqual(links(disabled, "/components/item-button/"), []);
  assert.deepEqual(links(dataSite(), "/components/button/"), []);
});
