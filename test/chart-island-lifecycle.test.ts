import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  enhanceChartIsland,
  type ChartIslandEnv,
  type IslandDisposer,
  type IslandIntersectionCtor,
  type IslandIntersectionEntry,
  type IslandMutationCtor,
  type IslandRoot,
} from "../components/chart-data/island.ts";
import { start, type ChartsGlobals } from "../components/charts/client.ts";
import { start as startPerformance, type PerformanceChartGlobals } from "../components/performance-chart/client.ts";

/** A root that knows whether it is still in a document. */
interface FakeRoot extends IslandRoot {
  readonly name: string;
  isConnected: boolean;
}

/** A fake root in a document. */
function fakeRoot(name: string): FakeRoot {
  return { name, isConnected: true };
}

/** An IntersectionObserver fake that records every target and lets the test fire entries. */
class FakeIntersection {
  readonly observed = new Set<unknown>();
  disconnected = false;
  readonly unobserved: unknown[] = [];
  private readonly callback: (entries: readonly IslandIntersectionEntry[]) => void;

  constructor(callback: (entries: readonly IslandIntersectionEntry[]) => void, _options: { rootMargin: string }) {
    this.callback = callback;
  }

  observe(target: unknown): void {
    this.observed.add(target);
  }

  unobserve(target: unknown): void {
    this.observed.delete(target);
    this.unobserved.push(target);
  }

  disconnect(): void {
    this.disconnected = true;
    this.observed.clear();
  }

  /** Reports `target` as having come near the viewport; an unobserved target is never reported. */
  enter(target: unknown): void {
    if (!this.observed.has(target)) return;
    this.callback([{ isIntersecting: true, target }]);
  }
}

/** A MutationObserver fake whose callback the test fires to simulate document changes. */
class FakeMutation {
  disconnected = false;
  readonly target: unknown = undefined;
  private readonly callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
  }

  observe(target: unknown, _options: { childList: boolean; subtree: boolean }): void {
    void target;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  mutate(): void {
    this.callback();
  }
}

/** Ctor fakes that record the instances they create. A constructor call returns the instance. */
function fakeObservers(): {
  Intersection: IslandIntersectionCtor;
  Mutation: IslandMutationCtor;
  intersections: FakeIntersection[];
  mutations: FakeMutation[];
} {
  const intersections: FakeIntersection[] = [];
  const mutations: FakeMutation[] = [];
  return {
    intersections,
    mutations,
    Intersection: function (this: unknown, callback: (entries: readonly IslandIntersectionEntry[]) => void, options: { rootMargin: string }): FakeIntersection {
      const instance = new FakeIntersection(callback, options);
      intersections.push(instance);
      return instance;
    } as unknown as IslandIntersectionCtor,
    Mutation: function (this: unknown, callback: () => void): FakeMutation {
      const instance = new FakeMutation(callback);
      mutations.push(instance);
      return instance;
    } as unknown as IslandMutationCtor,
  };
}

/** An environment over fake roots with counting fakes and per-root draw disposers. */
function fakeEnv(roots: FakeRoot[]): {
  environment: ChartIslandEnv<FakeRoot>;
  intersections: FakeIntersection[];
  mutations: FakeMutation[];
  drawn: FakeRoot[];
  destroyed: string[];
} {
  const { Intersection, Mutation, intersections, mutations } = fakeObservers();
  const drawn: FakeRoot[] = [];
  const destroyed: string[] = [];
  const environment: ChartIslandEnv<FakeRoot> = {
    roots: () => roots,
    draw(entered) {
      drawn.push(entered);
      return () => {
        destroyed.push(entered.name);
      };
    },
    Intersection,
    Mutation,
    mutationTarget: { tag: "document" },
  };
  return { environment, intersections, mutations, drawn, destroyed };
}

test("one island draws near-viewport roots once, through one observer", () => {
  const first = fakeRoot("first");
  const second = fakeRoot("second");
  const { environment, intersections, mutations, drawn } = fakeEnv([first, second]);
  const island = enhanceChartIsland(environment);

  assert.equal(intersections.length, 1, "one observer serves every root");
  assert.equal(mutations.length, 1, "one mutation observer serves the page");
  assert.deepEqual(drawn, [], "nothing draws before a root nears the viewport");
  assert.deepEqual([...intersections[0]!.observed], [first, second]);

  intersections[0]!.enter(first);
  assert.deepEqual(drawn, [first]);
  intersections[0]!.enter(first);
  assert.deepEqual(drawn, [first], "an entering root is drawn once, then unobserved");
  assert.deepEqual(intersections[0]!.unobserved, [first]);

  island.stop();
});

test("reinitializing disposes the previous enhancement and never stacks instances", () => {
  const entered = fakeRoot("chart");
  const { environment, intersections, drawn, destroyed } = fakeEnv([entered]);

  // First enhancement: one live instance after the root nears the viewport.
  const firstIsland = enhanceChartIsland(environment);
  intersections[0]!.enter(entered);
  assert.deepEqual(drawn, [entered]);
  assert.deepEqual(destroyed, [], "the first draw has nothing to replace");

  // Re-initialization stops the previous enhancement first (the client's start does this), so its
  // chart is destroyed and its observer disconnected.
  firstIsland.stop();
  assert.deepEqual(destroyed, ["chart"], "the replacement stopped the previous enhancement");
  assert.equal(intersections[0]!.disconnected, true, "the previous observer is disconnected");
  const secondIsland = enhanceChartIsland(environment);
  assert.equal(intersections.length, 2, "the replacement watches through its own observer");

  intersections[1]!.enter(entered);
  assert.deepEqual(drawn, [entered, entered]);
  assert.deepEqual(destroyed, ["chart"], "the replacement drew a fresh instance");

  secondIsland.stop();
  assert.deepEqual(destroyed, ["chart", "chart"], "stopping destroys the last live instance");
  firstIsland.stop();
  assert.equal(destroyed.length, 2, "stop is idempotent");
});

test("drawing a root that already holds an instance disposes the old instance first", () => {
  const entered = fakeRoot("chart");
  const drawn: string[] = [];
  const destroyed: string[] = [];
  // The draw-everything path runs again over a root that still holds an instance: the shape a
  // re-initialization takes when a root is drawn while its previous chart is live.
  const environment: ChartIslandEnv<FakeRoot> = {
    roots: () => [entered, entered],
    draw(seen) {
      drawn.push(seen.name);
      return () => {
        destroyed.push(seen.name);
      };
    },
  };
  const island = enhanceChartIsland(environment);
  assert.deepEqual(drawn, ["chart", "chart"]);
  assert.deepEqual(destroyed, ["chart"], "the second draw destroyed the first instance, not stacked it");
  island.stop();
  assert.deepEqual(destroyed, ["chart", "chart"], "stop destroyed the redraw's live instance");
});

test("a root removed from the document is released and no longer watched", () => {
  const kept = fakeRoot("kept");
  const removed = fakeRoot("removed");
  const { environment, intersections, mutations, destroyed } = fakeEnv([kept, removed]);
  const island = enhanceChartIsland(environment);
  const observer = intersections[0]!;

  observer.enter(kept);
  observer.enter(removed);
  assert.deepEqual(destroyed, []);

  removed.isConnected = false;
  mutations[0]!.mutate();
  assert.deepEqual(destroyed, ["removed"], "the removal sweep destroys the root's instance");
  assert.ok(!observer.observed.has(removed), "the released root is no longer watched");
  mutations[0]!.mutate();
  assert.deepEqual(destroyed, ["removed"], "a released root is not destroyed twice");

  island.stop();
  assert.deepEqual(destroyed, ["removed", "kept"], "stopping still destroys what remains");
});

test("a draw that settles after the island stopped is disposed, not registered", async () => {
  const entered = fakeRoot("late");
  let live = false;
  const environment: ChartIslandEnv<FakeRoot> = {
    roots: () => [entered],
    draw(): Promise<IslandDisposer> {
      return new Promise((resolve) => {
        queueMicrotask(() => {
          live = true;
          resolve(() => {
            live = false;
          });
        });
      });
    },
  };
  const island = enhanceChartIsland(environment);
  island.stop();
  await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
  await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
  assert.equal(live, false, "the late instance was destroyed instead of leaking");
});

test("a runtime without an IntersectionObserver draws every root at once", () => {
  const entered = fakeRoot("plain");
  const drawn: string[] = [];
  const environment: ChartIslandEnv<FakeRoot> = {
    roots: () => [entered],
    draw(seen) {
      drawn.push(seen.name);
      return () => {
        drawn.pop();
      };
    },
  };
  const island = enhanceChartIsland(environment);
  assert.deepEqual(drawn, ["plain"]);
  island.stop();
  assert.deepEqual(drawn, [], "stopping destroys the drawn instance");
});

test("stop is idempotent and a late entry callback draws nothing", () => {
  const entered = fakeRoot("once");
  const { environment, intersections, drawn, destroyed } = fakeEnv([entered]);
  const island = enhanceChartIsland(environment);

  island.stop();
  island.stop();
  intersections[0]!.enter(entered);
  assert.deepEqual(drawn, [], "a callback after stop draws nothing");
  assert.deepEqual(destroyed, [], "there was nothing to destroy");
});

/** The browser globals the charts island reads, over a jsdom page, with counting observer fakes. */
function domGlobals(markup: string): {
  globals: ChartsGlobals;
  intersections: FakeIntersection[];
} {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${markup}</body></html>`);
  const doc = dom.window.document;
  const { Intersection, Mutation, intersections } = fakeObservers();
  const globals: ChartsGlobals = {
    document: { querySelectorAll: (selector: string) => doc.querySelectorAll(selector) as unknown as Iterable<HTMLElement> },
    IntersectionObserver: Intersection,
    MutationObserver: Mutation,
  };
  return { globals, intersections };
}

test("the charts island starts from the page, draws through the observer, and reinits cleanly", () => {
  const { globals, intersections } = domGlobals(`<figure data-charts><canvas></canvas></figure>`);
  const stopCharts = start(globals);
  assert.equal(intersections.length, 1, "one initialization makes one observer");
  assert.equal(intersections[0]!.disconnected, false);
  const chartRoot = Array.from(globals.document!.querySelectorAll("[data-charts]"))[0];
  assert.ok(chartRoot);
  assert.deepEqual([...intersections[0]!.observed], [chartRoot], "the island watches the page's chart roots");

  const stopAgain = start(globals);
  assert.equal(intersections[0]!.disconnected, true, "reinitializing stopped the previous enhancement");
  assert.equal(intersections.length, 2, "the replacement watches through its own observer");

  stopCharts();
  stopAgain();
  assert.equal(intersections[1]!.disconnected, true, "both teardowns disconnect their observer");
});

test("the performance-chart island behaves the same way on reinit", () => {
  const dom = new JSDOM(`<!DOCTYPE html><html><body><figure data-performance-chart><canvas></canvas></figure></body></html>`);
  const doc = dom.window.document;
  const { Intersection, intersections } = fakeObservers();
  const globals: PerformanceChartGlobals = {
    document: { querySelectorAll: (selector: string) => doc.querySelectorAll(selector) as unknown as Iterable<HTMLElement> },
    IntersectionObserver: Intersection,
  };

  const first = startPerformance(globals);
  const second = startPerformance(globals);
  assert.equal(intersections.length, 2);
  assert.equal(intersections[0]!.disconnected, true, "the previous enhancement was disposed on reinit");

  const chartRoot = doc.querySelector("[data-performance-chart]");
  assert.ok(chartRoot);
  assert.deepEqual([...intersections[1]!.observed], [chartRoot], "the replacement watches the chart root");
  first();
  second();
  assert.equal(intersections[1]!.disconnected, true);
});

test("a page without chart roots initializes to nothing", () => {
  const dom = new JSDOM("<!DOCTYPE html><html><body><p>no charts here</p></body></html>");
  const doc = dom.window.document;
  const globals: ChartsGlobals = {
    document: { querySelectorAll: (selector: string) => doc.querySelectorAll(selector) as unknown as Iterable<HTMLElement> },
  };
  const stop = start(globals);
  stop();
  assert.ok(true, "an empty page starts and stops without touching the DOM");
});
