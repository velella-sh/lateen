/* The data explorer's I/O: the browser's `fetch` and timers behind the `ExplorerEnv` the island reads,
 * so tests can inject a fake fetch and clock. */

import { fetchJson, type Fetcher } from "../../src/fetch.ts";
import type { ExplorerEnv } from "./contract.ts";

/** The browser's `fetch`, absent in a test runtime. */
const browserFetch = (globalThis as unknown as { fetch?: Fetcher }).fetch;

/** The browser environment: `fetch`, and the document's timers. */
export const browserEnv: ExplorerEnv = {
  fetchJson: (url, signal) => fetchJson(browserFetch, url, signal),
  schedule: (listener, ms) => setTimeout(listener, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
