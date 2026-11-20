// Bounded condition polling for browser tests (#871): a case waits for the state it asserts on
// (a rendered row, an answered request, an announced status) instead of sleeping for a guessed delay.

export interface WaitOptions {
  /** Total time to keep reading before failing. Defaults to 1000ms. */
  timeout?: number;
  /** Time between reads. Defaults to 10ms. */
  interval?: number;
  /** Failure message; defaults to the timeout. */
  message?: string;
}

/** Reads `condition` until it is truthy, returns that value, and throws once `timeout` ms pass. */
export async function waitFor<T>(condition: () => T | Promise<T>, options: WaitOptions = {}): Promise<T> {
  const timeout = options.timeout ?? 1000;
  const interval = options.interval ?? 10;
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await condition();
    if (value) return value;
    if (Date.now() >= deadline) throw new Error(options.message ?? `condition was not met within ${timeout}ms`);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
