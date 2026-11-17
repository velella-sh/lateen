import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import timeline, { AXIS_CLASS, BAR_CLASS, CHART_CLASS, TICK_CLASS, TRACK_CLASS } from "../components/timeline/index.ts";

const items = (rows: readonly Record<string, unknown>[]): string => JSON.stringify(rows);

const rows = [
  { label: "First", start: "2026-01-01", end: "2026-01-09", status: "done" },
  { label: "Second", start: "2026-01-19", end: "2026-01-27", status: "new" },
];

const config = {
  base: "",
  theme: {
    options: {
      status: {
        values: {
          done: { tone: "positive" },
          late: { tone: "negative" },
        },
      },
    },
  },
};

const site = { config, nav: {}, data: {}, pages: [], collections: {} } as unknown as Site;
const page = { lang: "en", url: "/events/", frontMatter: {} } as unknown as Page;

function render(props: Record<string, unknown>, lang = "en"): string {
  const input = { props, page: { ...page, lang }, site, html: "" } as unknown as ComponentProps;
  return renderToString(timeline(input) as never);
}

test("two rows share one quarter axis, with a bar each", () => {
  const out = render({ items: items(rows) });
  assert.match(out, /class="timeline-axis"/);
  assert.match(out, /class="timeline-tick" style="inset-inline-start:0%">2026 Q1/);
  assert.equal([...out.matchAll(/class="timeline-tick"/g)].length, 1, "one quarter holds both rows");
  assert.match(
    out,
    /class="timeline-bar timeline-bar-positive" style="inset-inline-start:0%;inline-size:10%"/,
  );
  assert.match(
    out,
    /class="timeline-bar timeline-bar-neutral" style="inset-inline-start:20%;inline-size:10%"/,
  );
});

test("the bar sits in a decorative cell the data cells do not hide", () => {
  const out = render({ items: items(rows) });
  assert.match(out, new RegExp(`class="${CHART_CLASS}"`));
  assert.match(out, new RegExp(`class="${TRACK_CLASS}" aria-hidden="true"`));
  assert.match(out, new RegExp(`class="${AXIS_CLASS}"`));
  assert.match(out, new RegExp(`class="${TICK_CLASS}"`));
  assert.match(out, new RegExp(`class="${BAR_CLASS} ${BAR_CLASS}-positive"`));
  const cells = [...out.matchAll(/<td class="timeline-cell"[^>]*>/g)].map((match) => match[0]);
  assert.equal(cells.length, 8, "four data cells per row stay in the document");
  assert.ok(!cells.some((cell) => cell.includes("aria-hidden")), "no data cell is hidden");
});

test("the status tones colour the bars, and a row without a status is neutral", () => {
  const out = render({
    items: items([
      { label: "Done", start: "2026-01-01", end: "2026-01-02", status: "done" },
      { label: "Late", start: "2026-01-03", end: "2026-01-04", status: "late" },
      { label: "Plain", start: "2026-01-05", end: "2026-01-06" },
    ]),
  });
  assert.match(out, new RegExp(`class="${BAR_CLASS} ${BAR_CLASS}-positive"`));
  assert.match(out, new RegExp(`class="${BAR_CLASS} ${BAR_CLASS}-negative"`));
  assert.match(out, new RegExp(`class="${BAR_CLASS} ${BAR_CLASS}-neutral"`));
});

test("a row with no real date has no bar, and is still a row", () => {
  const out = render({
    items: items([
      { label: "Real", start: "2026-01-01", end: "2026-01-09" },
      { label: "Broken", start: "2026-02-30", end: "soon" },
    ]),
  });
  assert.equal([...out.matchAll(new RegExp(`class="${BAR_CLASS} `, "g"))].length, 1);
  assert.match(out, /<span class="timeline-invalid">&quot;2026-02-30&quot; in field &quot;start&quot;/);
  assert.match(out, /<td class="timeline-cell" data-field="label">Broken<\/td>/);
});

test("no bar is drawn when no row has a date the axis can hold", () => {
  const out = render({ items: items([{ label: "Broken", start: "soon", end: "later" }]) });
  assert.ok(!out.includes(CHART_CLASS), "no chart column without an axis");
});

test("the axis runs the other way on an RTL page, and the markup uses logical insets", () => {
  const out = render({ items: items(rows) }, "fa");
  assert.match(out, /inset-inline-start:0%/);
  assert.match(out, /class="timeline-tick"/);
  assert.ok(!/style="[^"]*\b(left|right):/.test(out), "no physical side in an inline style");
});

test("a longer range draws one tick per quarter of the axis", () => {
  const out = render({
    items: items([
      { label: "Spring", start: "2026-02-01", end: "2026-03-01" },
      { label: "Autumn", start: "2026-09-01", end: "2026-10-01" },
    ]),
  });
  const ticks = [...out.matchAll(/class="timeline-tick" style="inset-inline-start:([\d.]+)%">([^<]+)</g)];
  assert.deepEqual(ticks.map((tick) => tick[2]), ["2026 Q1", "2026 Q2", "2026 Q3", "2026 Q4"]);
  assert.ok(ticks.every((tick) => Number(tick[1]) >= 0 && Number(tick[1]) < 100));
});

test("a year axis labels whole years", () => {
  const spanning = [
    { label: "Long", start: "2020-01-01", end: "2023-12-31" },
    { label: "Later", start: "2021-06-01", end: "2022-06-01" },
  ];
  const out = render({ items: items(spanning) });
  assert.match(out, /inset-inline-start:0%">2020/);
  assert.match(out, /inset-inline-start:25\.\d+%">2021/);
  assert.match(out, /inset-inline-start:75\.\d+%">2023/);
});
