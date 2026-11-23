import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { before, test } from "node:test";
import { all, attrs, build, textOf, type BuiltSite } from "../integration-helpers.ts";

const recordUrl = "/monthly/2026-04/";
const listUrl = "/monthly/";
const downloads = ["/data/monthly.raw.json", "/data/monthly.csv", "/data/monthly.sha256"];
const calendar = "webcal://example.com/calendars/monthly.ics";
const privateInputs = /\binputs\b|parcel-(?:blue|green|red)/;

let site: BuiltSite;
before(() => {
  site = build("aggregate");
});

function assertFeeds(page: Document): void {
  const links = [
    "https://example.com/feeds/monthly.xml",
    "https://example.com/feeds/monthly.json",
  ];
  assert.deepEqual(attrs(page, 'head link[type="application/atom+xml"], head link[type="application/feed+json"]', "href"), links);
  assert.deepEqual(attrs(page, 'main a[type="application/atom+xml"], main a[type="application/feed+json"]', "href"), links);
}

test("an aggregate record renders summary facts and calendar actions without a data-file edit link", () => {
  const page = site.document(recordUrl);
  assert.equal(textOf(page.querySelector("main h1")), "Shipments for 2026-04");
  assert.deepEqual(all(page, "#record-facts dt, #record-facts dd").map(textOf), [
    "Shipments", "3",
    "Destinations", "2",
    "Total units", "30",
    "Average units", "10",
    "First shipment", "2 April 2026",
    "Largest shipment", "19",
  ]);
  assert.equal(page.querySelector(".edit-page-link"), null);
  assert.equal(page.querySelector(".snapshot-panel"), null);
  assert.deepEqual(attrs(page, "#collection-downloads + ul a", "href"), downloads);
  assert.doesNotMatch(textOf(page.querySelector(".record-body")), /shipment-source-snapshot|:snapshot/);
  assert.deepEqual(attrs(page, ".add-to-calendar-link", "href"), [`${recordUrl}calendar.ics`, calendar, "https://example.com/calendars/monthly.ics"]);
  assert.match(site.file(`${recordUrl}calendar.ics`), /DTSTART;VALUE=DATE:20260402/);
  assertFeeds(page);
});

test("an aggregate list links its single summary row, downloads, feeds, and calendar", () => {
  const page = site.document(listUrl);
  assert.equal(textOf(page.querySelector(".list-count")), "1 record");
  assert.equal(all(page, ".list-records tbody tr").length, 1);
  assert.deepEqual(all(page, ".list-records tbody td").map(textOf), [
    "2026-04", "2026-04", "3", "2", "30", "10", "2026-04-02", "19",
  ]);
  assert.deepEqual(attrs(page, ".list-records tbody a", "href"), [recordUrl]);
  assert.equal(page.querySelector(".snapshot-panel"), null);
  assert.deepEqual(attrs(page, "#collection-downloads + ul a", "href"), downloads);
  const checksums = ["monthly.csv", "monthly.raw.json"].map((file) => {
    const hash = createHash("sha256").update(site.file(`data/${file}`)).digest("hex");
    return `${hash}  ${file}`;
  });
  assert.equal(site.file("data/monthly.sha256"), `${checksums.join("\n")}\n`);
  assert.deepEqual(attrs(page, '.list-subscribe-link[href^="webcal:"]', "href"), [calendar]);
  assert.match(site.file("calendars/monthly.ics"), /SUMMARY:First shipment of 2026-04/);
  assertFeeds(page);
  assert.ok(site.file("feeds/monthly.xml").includes(`https://example.com${recordUrl}`));
  assert.deepEqual(JSON.parse(site.file("feeds/monthly.json")).items[0]._mizzen, { total: 30 });
});

test("public aggregate outputs omit internal inputs and the source's snapshot", () => {
  assert.equal(JSON.parse(site.file("data/shipments.raw.json")).snapshot.ref, "shipment-source-snapshot");
  assert.equal(JSON.parse(site.file("data/monthly.raw.json")).snapshot, undefined);
  assert.equal(JSON.parse(site.file("api/v1/monthly/2026-04.json")).fields.total, 30);
  assert.deepEqual(JSON.parse(site.file("search-facets.json")).filters.collection, { monthly: 1 });

  for (const path of [
    "monthly/2026-04/index.html", "monthly/2026-04/index.json", "monthly/2026-04/index.md",
    "monthly/index.html", "monthly/index.json", "data/monthly.raw.json", "data/monthly.csv",
    "data/monthly.json", "api/v1/monthly/2026-04.json", "api/v1/monthly.json", "api/v1/monthly.ndjson",
    "feeds/monthly.xml", "feeds/monthly.json", "calendars/monthly.ics", "search-facets.json",
  ]) {
    assert.doesNotMatch(site.file(path), privateInputs, path);
  }
});
