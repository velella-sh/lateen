import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import timeline, { LEGEND_CLASS, OVERLAP_CLASS, PHASE_CLASS } from "../components/timeline/index.ts";

const site = {
  config: {
    base: "",
    theme: {
      options: {
        status: {
          values: {
            done: { tone: "positive", label: "Done" },
            late: { tone: "negative", label: "Late" },
          },
        },
      },
    },
  },
  nav: {},
  data: {},
  pages: [],
  collections: {},
} as unknown as Site;

const page = { lang: "en", url: "/events/", frontMatter: {} } as unknown as Page;

function render(rows: readonly unknown[]): string {
  const input = { props: { items: JSON.stringify(rows) }, page, site, html: "" } as unknown as ComponentProps;
  return renderToString(timeline(input) as never);
}

const phase = (label: string, start: string, end: string, status = "done") => ({ label, start, end, status });

const row = (label: string, start: string, end: string, phases: readonly unknown[]) => ({
  label,
  start,
  end,
  status: "done",
  phases,
});

test("one phase draws a segment and names it in the legend", () => {
  const out = render([row("Launch", "2026-01-01", "2026-01-10", [phase("Build", "2026-01-01", "2026-01-10")])]);
  assert.equal((out.match(new RegExp(PHASE_CLASS, "g")) ?? []).length, 1);
  assert.match(out, new RegExp(`class="timeline-bar timeline-bar-positive ${PHASE_CLASS}"`));
  assert.match(out, /style="inset-inline-start:0%;inline-size:11\.11%"/);
  assert.match(out, new RegExp(`class="${LEGEND_CLASS}"`));
  assert.match(out, /<p class="timeline-legend-title">Phases<\/p>/);
  assert.match(out, /<li><span class="timeline-bar timeline-bar-positive" aria-hidden="true"><\/span>Build<\/li>/);
  assert.ok(!out.includes(OVERLAP_CLASS));
});

test("two adjoining phases touch and each keeps its tone in the legend", () => {
  const out = render([
    row("Release", "2026-01-01", "2026-03-01", [
      phase("Build", "2026-01-01", "2026-02-15"),
      phase("Review", "2026-02-16", "2026-03-01", "late"),
    ]),
  ]);
  assert.equal((out.match(new RegExp(PHASE_CLASS, "g")) ?? []).length, 2);
  assert.match(out, /class="timeline-bar timeline-bar-positive timeline-phase" style="inset-inline-start:0%;inline-size:51\.11%"/);
  assert.match(
    out,
    /class="timeline-bar timeline-bar-negative timeline-phase" style="inset-inline-start:51\.11%;inline-size:15\.56%"/,
  );
  assert.match(out, /<li><span class="timeline-bar timeline-bar-negative" aria-hidden="true"><\/span>Review<\/li>/);
  assert.ok(!out.includes(OVERLAP_CLASS));
});

test("three phases draw three segments in one row", () => {
  const out = render([
    row("Quarter", "2026-01-01", "2026-03-01", [
      phase("Plan", "2026-01-01", "2026-01-10"),
      phase("Build", "2026-01-11", "2026-02-10"),
      phase("Ship", "2026-02-11", "2026-03-01", "late"),
    ]),
  ]);
  assert.equal((out.match(new RegExp(PHASE_CLASS, "g")) ?? []).length, 3);
  assert.match(out, /style="inset-inline-start:11\.11%;inline-size:34\.44%"/);
  assert.match(out, /style="inset-inline-start:45\.56%;inline-size:21\.11%"/);
  assert.equal((out.match(/<li>/g) ?? []).length, 3);
  assert.ok(!out.includes(OVERLAP_CLASS));
});

test("a gap between phases draws a gap, not an overlap message", () => {
  const out = render([
    row("Year", "2026-01-01", "2026-03-31", [
      phase("Draft", "2026-01-01", "2026-01-31"),
      phase("Review", "2026-03-01", "2026-03-31", "late"),
    ]),
  ]);
  assert.equal((out.match(new RegExp(PHASE_CLASS, "g")) ?? []).length, 2);
  assert.match(out, /style="inset-inline-start:0%;inline-size:34\.44%"/);
  assert.match(out, /style="inset-inline-start:65\.56%;inline-size:34\.44%"/);
  assert.ok(!out.includes(OVERLAP_CLASS));
});

test("overlapping phases in one row are named in a visible message", () => {
  const out = render([
    row("Release", "2026-01-01", "2026-03-01", [
      phase("Build", "2026-01-01", "2026-02-15"),
      phase("Review", "2026-02-01", "2026-03-01", "late"),
    ]),
  ]);
  assert.equal((out.match(new RegExp(PHASE_CLASS, "g")) ?? []).length, 2);
  assert.match(out, new RegExp(`class="${OVERLAP_CLASS}" role="note"`));
  assert.match(out, /Phases overlap in this row: Build, Review\./);
});
