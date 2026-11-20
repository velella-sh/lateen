/// <reference lib="dom" />

import { enhanceChartIsland, type ChartIslandControl, type IslandIntersectionCtor, type IslandMutationCtor } from "../chart-data/island.ts";

type ChartRow = { label: string; value: number };

/** The Chart constructor the generated bundle supplies; each instance is destroyed on disposal. */
interface ChartLike {
  new (context: CanvasRenderingContext2D, config: unknown): { destroy(): void };
}

/** Draws one chart and returns the disposal of the instance it created. */
async function draw(root: HTMLElement): Promise<(() => void) | undefined> {
  const canvas = root.querySelector("canvas");
  const data = root.querySelector("[data-chart-data]")?.textContent;
  if (!(canvas instanceof HTMLCanvasElement) || !data) return;
  const rows = JSON.parse(data) as ChartRow[];
  // @ts-expect-error The generated chart bundle has no TypeScript declarations.
  const { default: Chart } = await import("../performance-chart/chart.min.js");
  const context = canvas.getContext("2d");
  if (!context) return;
  const styles = getComputedStyle(root);
  const type = root.dataset.chartType === "line" ? "line" : "bar";
  const colors = [
    styles.getPropertyValue("--chart-1").trim() || "#4c6f9a",
    styles.getPropertyValue("--chart-2").trim() || "#8f8cd8",
    styles.getPropertyValue("--chart-3").trim() || "#8fb0d4",
  ];
  const chart = new (Chart as ChartLike)(context, {
    type,
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{
        data: rows.map((row) => row.value),
        backgroundColor: type === "bar" ? rows.map((_, index) => colors[index % colors.length]) : colors[1],
        borderColor: colors[0],
        borderRadius: 6,
        maxBarThickness: 28,
        tension: 0.35,
        fill: false,
      }],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: styles.getPropertyValue("--muted-foreground") },
        },
        y: {
          beginAtZero: true,
          ticks: { color: styles.getPropertyValue("--muted-foreground") },
          grid: { color: styles.getPropertyValue("--border") },
        },
      },
    },
  });
  canvas.hidden = false;
  root.querySelector(".charts-fallback")?.setAttribute("hidden", "");
  return () => chart.destroy();
}

/** Everything the island reads from the browser, so tests can pass fakes instead of the page. */
export interface ChartsGlobals {
  document?: { querySelectorAll(selector: string): Iterable<HTMLElement> };
  IntersectionObserver?: IslandIntersectionCtor;
  MutationObserver?: IslandMutationCtor;
}

/** The teardown of the enhancement that is running now; re-initializing stops it first. */
let active: (() => void) | undefined;

/**
 * Enhances every chart root on the page, replacing any enhancement that is still active: the
 * previous charts are destroyed and its observers disconnected first, so repeated initialization
 * does not increase observer, listener, or instance counts. A runtime without a document is a no-op.
 */
export function start(globals: ChartsGlobals = globalThis as unknown as ChartsGlobals): () => void {
  active?.();
  const control: ChartIslandControl = enhanceChartIsland<HTMLElement>({
    roots: () => globals.document?.querySelectorAll("[data-charts]") ?? [],
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
