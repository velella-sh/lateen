import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import timeline, {
  BAR_CLASS,
  ONGOING_CLASS,
  OPEN_END_CLASS,
  OPEN_START_CLASS,
  PHASE_CLASS,
} from "../components/timeline/index.ts";

const site = {
  config: {
    base: "",
    theme: { options: { status: { values: { done: { tone: "positive" } } } } },
  },
  nav: {},
  data: {},
  pages: [],
  collections: {},
} as unknown as Site;

const page = { lang: "en", url: "/events/", frontMatter: {} } as unknown as Page;

function render(
  rows: readonly Record<string, unknown>[],
  lang = "en",
  props: Record<string, unknown> = {},
): string {
  const input = {
    props: { items: JSON.stringify(rows), ...props },
    page: { ...page, lang },
    site,
    html: "",
  } as unknown as ComponentProps;
  return renderToString(timeline(input) as never);
}

/** One row is still running, one began before the axis. */
const open = [
  { label: "Live", start: "2026-01-09", end: null, status: "done" },
  { label: "Legacy", start: null, end: "2026-01-19", status: "done" },
];

test("a row without an end date runs to the edge of the axis, with an open end", () => {
  const out = render(open);
  assert.match(
    out,
    /class="timeline-bar timeline-bar-positive timeline-bar-open-end" style="inset-inline-start:8\.89%;inline-size:91\.11%"/,
  );
  const bars = [...out.matchAll(/<span class="timeline-bar[^"]*"/g)].map((match) => match[0]);
  assert.ok(bars.some((bar) => bar.includes(OPEN_END_CLASS) && !bar.includes(OPEN_START_CLASS)), "one end is open");
  assert.match(
    out,
    new RegExp(`<td class="timeline-cell" data-field="end"><span class="${ONGOING_CLASS}">Ongoing</span></td>`),
  );
});

test("a row without a start date runs from the start edge of the axis, with an open start", () => {
  const out = render(open);
  assert.match(
    out,
    /class="timeline-bar timeline-bar-positive timeline-bar-open-start" style="inset-inline-start:0%;inline-size:21\.11%"/,
  );
  const bars = [...out.matchAll(/<span class="timeline-bar[^"]*"/g)].map((match) => match[0]);
  assert.ok(bars.some((bar) => bar.includes(OPEN_START_CLASS) && !bar.includes(OPEN_END_CLASS)), "one start is open");
  assert.match(
    out,
    new RegExp(`<td class="timeline-cell" data-field="start"><span class="${ONGOING_CLASS}">Ongoing</span></td>`),
  );
});

test("a phase with no end date is open too, and an empty value is not a made-up date", () => {
  const out = render([
    {
      label: "Launch",
      start: "2026-01-01",
      end: "2026-03-31",
      status: "done",
      phases: [{ label: "Beta", start: "2026-01-09", end: null, status: "done" }],
    },
  ]);
  assert.match(
    out,
    new RegExp(
      `class="timeline-bar timeline-bar-positive ${PHASE_CLASS} ${OPEN_END_CLASS}" style="inset-inline-start:8\\.89%;inline-size:91\\.11%"`,
    ),
  );
});

test("the open end and the open start are named in every language", () => {
  const expected: readonly (readonly [string, string])[] = [
    ["en", "Ongoing"],
    ["fa", "در جریان"],
    ["ar", "جارٍ"],
  ];
  for (const [lang, text] of expected) {
    const out = render(open, lang);
    assert.equal(
      [...out.matchAll(new RegExp(`<span class="${ONGOING_CLASS}">${text}</span>`, "g"))].length,
      2,
      `${lang}: both open dates state "${text}"`,
    );
    assert.match(out, new RegExp(OPEN_END_CLASS), `${lang}: one open end`);
    assert.match(out, new RegExp(OPEN_START_CLASS), `${lang}: one open start`);
  }
});

test("a date that is not ISO 8601 is an error, not an open end", () => {
  const out = render([
    { label: "Real", start: "2026-01-01", end: "2026-01-09" },
    { label: "Broken", start: "soon", end: "later" },
  ]);
  assert.ok(!out.includes(OPEN_END_CLASS), "a typo does not read as ongoing");
  assert.ok(!out.includes(OPEN_START_CLASS), "a typo does not read as ongoing");
  assert.ok(!out.includes(ONGOING_CLASS), "a typo does not read as ongoing");
  assert.match(out, /<span class="timeline-invalid">&quot;soon&quot; in field &quot;start&quot;/);
  assert.equal([...out.matchAll(new RegExp(`class="${BAR_CLASS} `, "g"))].length, 1, "only the real row is drawn");
});

test("a row with no dates at all has no bar and no open end", () => {
  const out = render([
    { label: "Real", start: "2026-01-01", end: "2026-01-09" },
    { label: "Undated", start: null, end: null },
  ]);
  assert.ok(!out.includes(OPEN_END_CLASS), "nothing to draw to an edge");
  assert.ok(!out.includes(OPEN_START_CLASS));
  assert.match(
    out,
    new RegExp(`<td class="timeline-cell" data-field="start"><span class="${ONGOING_CLASS}">Ongoing</span></td>`),
  );
});

test("a date field the rows do not have stays a visible message, not an open end", () => {
  const out = render([{ label: "Typo", begins: "2026-01-09", finish: "2026-02-01" }], "en", {
    start: "begins",
    end: "ends",
  });
  assert.match(out, /No field named &quot;ends&quot;\./);
  assert.ok(!out.includes(ONGOING_CLASS), "a mistyped field name is not read as ongoing");
  assert.ok(!out.includes(OPEN_END_CLASS));
});
