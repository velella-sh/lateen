import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import { facetScript, searchFacetControls, searchFacetsOf } from "../../layouts/shared/search-facets.ts";
import { layoutProps, pageWith, siteWith } from "../helpers-embed.ts";
import { pageRecord } from "../helpers/record.ts";

const property = "data-search-facets";
const facets = { url: "/docs/search-facets.json", sorts: ["released"] };

test("facets live under the site base and sorting exposes only public fields", () => {
  const record = pageWith({ record: pageRecord({ collection: "components", id: "button" }) });
  const site = siteWith([record], {
    base: "/docs",
    collections: {
      components: { source: "_data/components.yml", search: { sort: ["released", "hidden"] }, public: ["released"] },
    },
  });
  assert.deepEqual(searchFacetsOf(site), facets);
  assert.equal(searchFacetsOf({ ...site, pages: [] }), undefined);
  assert.equal(searchFacetsOf({ ...site, config: { ...site.config, search: false } }), undefined);
});

test("facets restore URL selections, label controls, and preserve query options on submit", async () => {
  const page = pageWith({ lang: "fa", dir: "rtl" });
  const props = layoutProps(page, siteWith([page]));
  const controls = renderToString(searchFacetControls(props, facets));
  const { window } = new JSDOM(`<form><input name="q" value="button">${controls}</form>`, {
    url: "https://example.com/docs/search/?q=button&filter.status=stable&sort=released&order=desc",
  });
  const { document } = window;
  const source = facetScript(facets, { any: "همه", collection: "مجموعه" });
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    return { ok: true, json: async () => ({
      query: { text: "q", filter: "filter.{field}", sort: "sort", order: "order" },
      filters: { collection: { components: 12 }, status: { stable: 8, "<b>Beta</b>": 2 } },
    }) };
  };
  const initialize = new Function("root", "location", "scope", "lang", "document", "fetch", `${source}\nreturn searchOptions;`);
  const options = initialize(document, window.location, "project", "fa", document, fetcher);
  assert.deepEqual(options, { filters: { status: "stable" }, sort: { released: "desc" } });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [facets.url]);
  assert.equal(document.querySelector("fieldset")?.hasAttribute("hidden"), false);
  assert.equal(document.querySelector("legend")?.textContent, "فیلترها");
  assert.equal(document.querySelector<HTMLSelectElement>('select[name="filter.status"]')?.value, "stable");
  assert.equal(document.querySelector<HTMLSelectElement>('select[name="order"]')?.value, "desc");
  assert.match(document.querySelector('select[name="filter.collection"]')?.textContent ?? "", /۱۲/);
  assert.equal(document.querySelector("select b"), null);

  const form = document.querySelector("form")!;
  const formData = new window.FormData(form);
  const event = new window.Event("formdata");
  Object.defineProperty(event, "formData", { value: formData });
  form.dispatchEvent(event);
  assert.deepEqual([...formData], [["q", "button"], ["filter.status", "stable"], ["sort", "released"], ["order", "desc"]]);
  assert.ok(document.querySelector(`[${property}] label > select`));
});
