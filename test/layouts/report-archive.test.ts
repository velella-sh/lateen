import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import { activate, type GalleryDocument } from "../../components/gallery-filters/island.ts";
import { build, type BuiltSite } from "../integration-helpers.ts";

const config = `title: Scan reports
url: https://example.com
base: /docs
lang: en
repository:
  url: https://github.com/example/scans
collections:
  scans:
    source: _data/scans.yml
    template: _templates/scan.md
    permalink: /scans/{id}/
    dates: [date]
    public: [date, commit, title, status, inputs.source, inputs.ref]
`;

const old = "a".repeat(40);
const newest = "b".repeat(40);
const data = `- id: scan-1
  title: First scan
  date: 2026-03-01
  commit: "${old}"
  status: clean
  inputs:
    source: scans/archived.json
    ref: "aaa-snapshot"
    tool: private-tool
- id: scan-2
  title: Second scan
  date: 2026-03-08
  commit: "${newest}"
  status: drift
`;

function listing(title: string, layout: string, extra: string, filter: string): string {
  return `---
title: ${title}
layout: ${layout}
${extra}list:
  collection: scans
  sort: date desc
  fields: [date, commit, status]
${filter}---
`;
}

let site: BuiltSite;

before(() => {
  site = build("data-site", process.env, {
    "mizzen.yml": config,
    "_data/scans.yml": data,
    "_templates/scan.md": "---\ntitle: 'Scan {id}'\n---\nReport body.\n",
    "gallery.md": listing("Scan gallery", "gallery", "", ""),
    "latest.md": listing("Latest scan", "list", "", "  perPage: 1\n"),
  });
});

test("the Mizzen report recipe shows dates, linked short commits, latest, and public pinned inputs", () => {
  const gallery = site.document("/gallery/");
  const cards = [...gallery.querySelectorAll(".report-run")];
  assert.deepEqual(cards.map((card) => card.querySelector("time")?.getAttribute("datetime")), ["2026-03-08", "2026-03-01"]);
  assert.equal(cards[0]?.querySelector(".version-badge")?.textContent, "Latest run");
  assert.equal(cards[0]?.querySelector(".report-run-inputs"), null);
  assert.equal(cards[1]?.querySelector(".version-badge"), null);
  assert.equal(cards[1]?.querySelector(".report-run-commit a")?.getAttribute("href"), `https://github.com/example/scans/commit/${old}`);
  assert.equal(cards[1]?.querySelector(".report-run-commit code")?.textContent, "aaaaaaa");
  assert.match(cards[1]?.querySelector(".report-run-inputs")?.textContent ?? "", /scans\/archived\.json.*aaa-snapshot/);
  assert.doesNotMatch(gallery.body.textContent ?? "", /private-tool/);
  assert.equal(cards[1]?.querySelector(".card-title")?.getAttribute("href"), "/docs/scans/scan-1/");
  assert.equal(gallery.querySelector('form[data-gallery-dates]')?.hasAttribute("hidden"), true);
  assert.ok(gallery.querySelector('script[src="/docs/assets/theme/islands/components/gallery-filters/client.js"]'));
});

test("each archived page links to the stable latest URL including the site base", () => {
  for (const id of ["scan-1", "scan-2"]) {
    const doc = site.document(`/scans/${id}/`);
    const link = doc.querySelector(".report-archive-notice a");
    assert.equal(link?.textContent, "View the latest report");
    assert.equal(link?.getAttribute("href"), "/docs/latest/");
  }
  assert.equal(site.document("/latest/").querySelector(".report-archive-notice"), null);
});

test("the date range filters inclusively and updates the count without navigating", () => {
  const dom = new JSDOM(site.html("/gallery/"), { url: "https://example.com/docs/gallery/" });
  after(() => dom.window.close());
  const { document } = dom.window;
  const teardown = activate(document as unknown as GalleryDocument);
  after(teardown);
  const form = document.querySelector<HTMLFormElement>("[data-gallery-dates]")!;
  const first = form.querySelector<HTMLInputElement>('input[name="start"]')!;
  const last = form.querySelector<HTMLInputElement>('input[name="end"]')!;
  const dates = () => [...document.querySelectorAll("[data-gallery-date]:not([hidden]) time")].map((node) => node.getAttribute("datetime"));

  const submit = () => form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(form.hidden, false);
  assert.deepEqual(dates(), ["2026-03-08", "2026-03-01"]);
  first.value = "2026-03-08";
  assert.equal(submit(), false);
  assert.deepEqual(dates(), ["2026-03-08"]);
  assert.match(document.querySelector(".gallery-count")?.textContent ?? "", /1 of 2/);

  first.value = "2026-03-01";
  last.value = "2026-03-01";
  submit();
  assert.equal(dom.window.location.search, "");
  assert.deepEqual(dates(), ["2026-03-01"]);

  first.value = "";
  last.value = "";
  submit();
  assert.deepEqual(dates(), ["2026-03-08", "2026-03-01"]);
});

test("a configured latest path works without a repository URL", () => {
  const custom = build("data-site", process.env, {
    "mizzen.yml": config.replace("repository:\n  url: https://github.com/example/scans\n", ""),
    "_data/scans.yml": data,
    "_templates/scan.md": "---\ntitle: 'Scan {id}'\n---\nReport body.\n",
    "gallery.md": listing("Scan gallery", "gallery", "reportArchive: { latest: /current/ }\n", ""),
    "current.md": listing("Latest scan", "list", "", "  perPage: 1\n"),
  });

  const gallery = custom.document("/gallery/");
  assert.equal(gallery.querySelector(".report-run .version-badge")?.textContent, "Latest run");
  assert.equal(gallery.querySelector(".report-run-commit code")?.textContent, "bbbbbbb");
  assert.equal(gallery.querySelector(".report-run-commit a"), null);
  assert.equal(custom.document("/scans/scan-1/").querySelector(".report-archive-notice a")?.getAttribute("href"), "/docs/current/");
});
