/**
 * The lifecycle the chart islands share: every chart instance a root creates is tracked from its
 * creation to its disposal, a redraw disposes the instance it replaces, a root removed from the
 * document has its instance destroyed and its observation released, and stopping the island
 * destroys every live instance and disconnects every observer it created. Re-initializing an
 * island therefore never increases observer, listener, or instance counts. This module stays
 * dependency-free (no `preact`), because the island build bundles it into the browser alongside
 * the build-time components. A Chart.js instance carries its own resize handling, so destroying
 * it is what releases the resize observers and listeners the chart attached.
 */

/** What the lifecycle disposes for one root: destroying the chart, removing a listener. */
export type IslandDisposer = () => void;

/** One viewport entry, as the browser's IntersectionObserver reports it. */
export interface IslandIntersectionEntry {
  readonly isIntersecting: boolean;
  readonly target: unknown;
}

/** An IntersectionObserver-like, as the browser supplies one. */
export interface IslandIntersection {
  observe(target: unknown): void;
  unobserve(target: unknown): void;
  disconnect(): void;
}

/** An IntersectionObserver constructor, as the browser supplies one. */
export type IslandIntersectionCtor = new (
  callback: (entries: readonly IslandIntersectionEntry[]) => void,
  options: { rootMargin: string },
) => IslandIntersection;

/** A MutationObserver-like, used only to learn that the document changed. */
export interface IslandMutation {
  observe(target: unknown, options: { childList: boolean; subtree: boolean }): void;
  disconnect(): void;
}

/** A MutationObserver constructor, as the browser supplies one. */
export type IslandMutationCtor = new (callback: () => void) => IslandMutation;

/** The smallest root the lifecycle tracks: enough to learn that it left the document. */
export interface IslandRoot {
  readonly isConnected: boolean;
}

/** Everything the lifecycle needs to draw one island, so tests can pass fakes. */
export interface ChartIslandEnv<Root extends IslandRoot> {
  /** The chart roots on the page. */
  roots(): Iterable<Root>;
  /**
   * Draws one root and returns how to dispose of what it created, if anything. A promise is
   * accepted: the instance registers when the draw settles.
   */
  draw(root: Root): IslandDisposer | void | Promise<IslandDisposer | void>;
  /** The browser's IntersectionObserver; a runtime without one draws every root at once. */
  Intersection?: IslandIntersectionCtor | undefined;
  /** The browser's MutationObserver; a runtime without one keeps charts until the island stops. */
  Mutation?: IslandMutationCtor | undefined;
  /** The node whose subtree is watched for removals; the document in the browser. */
  mutationTarget?: unknown | undefined;
}

/** Stopping one enhancement: idempotent, and safe to call while a draw is still settling. */
export interface ChartIslandControl {
  /** Destroys every chart this island still holds and disconnects its observers. */
  stop(): void;
}

/**
 * Runs one chart island: draws each root as it nears the viewport, releases the resources of a
 * root that left the document, and returns the teardown. Calling `stop` twice does nothing, and
 * an entry callback that fires after `stop` draws nothing.
 */
export function enhanceChartIsland<Root extends IslandRoot>(env: ChartIslandEnv<Root>): ChartIslandControl {
  let active = true;
  const disposers = new Map<Root, IslandDisposer>();
  let intersection: IslandIntersection | undefined;
  let mutation: IslandMutation | undefined;

  /** Destroys the root's chart, if it still has one. */
  const dispose = (root: Root): void => {
    const disposer = disposers.get(root);
    if (disposer === undefined) return;
    disposers.delete(root);
    disposer();
  };

  /** Stops watching a root and destroys its chart: it left the page. */
  const release = (root: Root): void => {
    intersection?.unobserve(root);
    dispose(root);
  };

  /** Draws one root, first destroying the instance a previous draw left behind. */
  const drawRoot = (root: Root): void => {
    if (!active) return;
    dispose(root);
    const settle = (disposer: IslandDisposer | void): void => {
      if (disposer === undefined) return;
      if (!active) {
        disposer();
        return;
      }
      disposers.set(root, disposer);
    };
    const result = env.draw(root);
    if (result instanceof Promise) void result.then(settle);
    else settle(result);
  };

  /** Destroys the charts of every root no longer in the document. */
  const sweep = (): void => {
    for (const root of [...disposers.keys()]) {
      if (!root.isConnected) release(root);
    }
  };

  if (env.Intersection === undefined) {
    for (const root of env.roots()) drawRoot(root);
  } else {
    const observer = new env.Intersection((entries) => {
      if (!active) return;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        drawRoot(entry.target as Root);
      }
    }, { rootMargin: "300px" });
    intersection = observer;
    for (const root of env.roots()) observer.observe(root);
  }

  if (env.Mutation !== undefined && env.mutationTarget !== undefined) {
    const observer = new env.Mutation(sweep);
    observer.observe(env.mutationTarget, { childList: true, subtree: true });
    mutation = observer;
  }

  return {
    stop(): void {
      if (!active) return;
      active = false;
      intersection?.disconnect();
      mutation?.disconnect();
      intersection = undefined;
      mutation = undefined;
      for (const root of [...disposers.keys()]) dispose(root);
    },
  };
}
