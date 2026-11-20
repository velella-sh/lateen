/**
 * The one request boundary the islands share. A response that is not `ok` is the same failure
 * everywhere; an abort stays the browser's own `AbortError` so a caller that superseded its request
 * can tell it apart from a real failure, and the body is read once, as text, here.
 */

import { parseJson } from "./guards.ts";

/** The part of a response the boundary reads; `status` is optional for a test double. */
export interface FetchResponse {
  readonly ok: boolean;
  readonly status?: number;
  text(): Promise<string>;
}

/** What a request may carry: the caller's abort signal. */
export interface FetchInit {
  readonly signal?: AbortSignal | undefined;
}

/** `fetch` as the islands use it, without the DOM's request and response types. */
export type Fetcher = (url: string, init?: FetchInit) => Promise<FetchResponse>;

/** Why a request produced no body; an abort is never one of these. */
export type FetchFailure = "unavailable" | "http" | "parse";

/** A request that produced no body, with the reason a caller may branch on. */
export class FetchError extends Error {
  readonly failure: FetchFailure;
  readonly status: number | undefined;

  constructor(failure: FetchFailure, message: string, status?: number) {
    super(message);
    this.name = "FetchError";
    this.failure = failure;
    this.status = status;
  }
}

/** True for the browser's abort, whichever realm raised it. */
export function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

/**
 * Sends one request and resolves only when it answered `ok`. A missing `fetch` and an HTTP error are
 * `FetchError`s; an abort rejects with the browser's `AbortError` untouched.
 */
export async function request(fetcher: Fetcher | undefined, url: string, init?: FetchInit): Promise<FetchResponse> {
  if (fetcher === undefined) throw new FetchError("unavailable", "fetch is unavailable");
  const response = await fetcher(url, init);
  if (!response.ok) throw new FetchError("http", `${url}: HTTP ${response.status ?? "error"}`, response.status);
  return response;
}

/** Reads one body as text. */
export async function fetchText(fetcher: Fetcher | undefined, url: string, signal?: AbortSignal): Promise<string> {
  const response = await request(fetcher, url, signal === undefined ? undefined : { signal });
  return response.text();
}

/** Reads one body as JSON; malformed JSON and non-JSON content are `parse` failures. */
export async function fetchJson(fetcher: Fetcher | undefined, url: string, signal?: AbortSignal): Promise<unknown> {
  const value = parseJson(await fetchText(fetcher, url, signal));
  if (value === undefined) throw new FetchError("parse", `${url}: not JSON`);
  return value;
}
