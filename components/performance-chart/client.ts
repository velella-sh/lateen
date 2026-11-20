/// <reference lib="dom" />

import { parseJson } from "../../src/guards.ts";
import { chartRows } from "../chart-data/input.ts";
import { enhanceChartIsland, type ChartIslandControl, type IslandIntersectionCtor, type IslandMutationCtor } from "../chart-data/island.ts";

/** The Chart constructor the generated bundle supplies; each instance is destroyed on disposal. */
interface ChartLike {
  new (context: CanvasRenderingContext2D, config: unknown): { destroy(): void };
}

/** Draws one chart and returns the disposal of the instance it created. */
async function draw(root: HTMLElement): Promise<(() => void) | undefined> {
  const canvas = root.querySelector("canvas");
  const data = root.querySelector("[data-chart-data]")?.textContent;
  if (!(canvas instanceof HTMLCanvasElement) || !data) return;
  const parsed = parseJson(data);
  // The shared chart validation: only rows with a label and a finite value are drawn.
  const rows = chartRows(parsed);
  // @ts-expect-error The generated chart bundle has no TypeScript declarations.
  const { default: Chart } = await import("./chart.min.js");
  const context = canvas.getContext("2d");
  if (!context) return;
  const styles = getComputedStyle(root);
  const chart = new (Chart as ChartLike)(context, {
    type: "bar",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{
        data: rows.map((row) => row.value),
        backgroundColor: [styles.getPropertyValue("--chart-2"), styles.getPropertyValue("--chart-1"), styles.getPropertyValue("--chart-3")],
        borderRadius: 8,
        maxBarThickness: 56,
      }],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: styles.getPropertyValue("--muted-foreground") } },
        y: { beginAtZero: true, suggestedMax: 80, ticks: { color: styles.getPropertyValue("--muted-foreground"), callback: (value: number) => `${value} KB` }, grid: { color: styles.getPropertyValue("--border") } },
      },
    },
  });
  canvas.hidden = false;
  return () => chart.destroy();
}

/** Everything the island reads from the browser, so tests can pass fakes instead of the page. */
export interface PerformanceChartGlobals {
  document?: { querySelectorAll(selector: string): Iterable<HTMLElement> };
  IntersectionObserver?: IslandIntersectionCtor;
  MutationObserver?: IslandMutationCtor;
}

/** The teardown of the enhancement that is running now; re-initializing stops it first. */
let active: (() => void) | undefined;

/**
 * Enhances every performance-chart root on the page, replacing any enhancement that is still
 * active: the previous charts are destroyed and its observers disconnected first, so repeated
 * initialization does not increase observer, listener, or instance counts. A runtime without a
 * document is a no-op.
 */
export function start(globals: PerformanceChartGlobals = globalThis as unknown as PerformanceChartGlobals): () => void {
  active?.();
  const control: ChartIslandControl = enhanceChartIsland<HTMLElement>({
    roots: () => globals.document?.querySelectorAll("[data-performance-chart]") ?? [],
    draw,
    Intersection: globals.IntersectionObserver,
    Mutation: globals.MutationObserver,
    mutationTarget: globals.document,
  });
  active = control.stop;
  return control.stop;
}

// The island runs when the browser loads it; nothing happens in a runtime without a document.
start();
