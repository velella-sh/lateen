// Reports the cases slower than SLOW_MS once a node:test run ends (#920). The reporter is
// additive: it yields only its summary, so the spec output a run already prints is unchanged.
// A slow setup becomes visible instead of hiding behind a raised timeout.
export const SLOW_MS = Number(process.env.SLOW_TEST_MS ?? 500);

export interface CaseResult {
  readonly name: string;
  readonly duration: number;
}

/** The cases at or over `threshold`, slowest first, ties by name so two runs print the same report. */
export function slowCases(results: readonly CaseResult[], threshold = SLOW_MS): CaseResult[] {
  return results
    .filter((result) => result.duration >= threshold)
    .sort((a, b) => b.duration - a.duration || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

interface TestEvent {
  readonly type: string;
  readonly data: {
    readonly name?: string;
    readonly file?: string;
    readonly duration_ms?: number;
    readonly details?: { readonly type?: string; readonly duration_ms?: number };
  };
}

/** A node:test reporter that reads the whole run, then prints the slow cases. */
export default async function* slowReport(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
  let file = "";
  const results: CaseResult[] = [];
  for await (const event of source) {
    if (event.data.file !== undefined) file = event.data.file;
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    const { name = "", details } = event.data;
    const duration = details?.duration_ms ?? event.data.duration_ms;
    if (details?.type === "suite" || duration === undefined) continue;
    results.push({ name: file === "" ? name : `${file} > ${name}`, duration });
  }
  const slow = slowCases(results);
  if (slow.length === 0) return;
  yield `slow tests (>= ${SLOW_MS}ms):\n`;
  for (const { name, duration } of slow) yield `  ${duration}ms  ${name}\n`;
}
