// Save-and-restore for the process state a test borrows: environment variables, globalThis
// properties such as fetch or the console, the working directory, and the exit code (#868). The
// scoped variants guarantee restoration when the body throws; the teardown variants register the
// restore with the test's own `after` hook, so randomized test order cannot leak one test's state
// into the next.
import { after } from "node:test";

/** Anything with an `after` hook: a node:test context; the whole file when omitted. */
export interface RestoreScope {
  after(hook: () => void | Promise<void>): unknown;
}

/** The value `name` had before, and a put that can also delete it again. */
function takeEnv(name: string): [original: string | undefined, put: (value: string | undefined) => void] {
  const original = process.env[name];
  const put = (value: string | undefined): void => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  return [original, put];
}

/** The `globalThis` property `name` had before, and a put that can also delete it again. */
function takeGlobal(name: string): [original: unknown, put: (value: unknown) => void] {
  const record = globalThis as unknown as Record<string, unknown>;
  const original = record[name];
  const put = (value: unknown): void => {
    if (value === undefined) delete record[name];
    else record[name] = value;
  };
  return [original, put];
}

/** Registers `put(original)` with the test's teardown hook, or the whole file's when no scope is given. */
function restoreAt<T>(original: T | undefined, put: (value: T | undefined) => void, scope?: RestoreScope): void {
  (scope ? (hook: () => void | Promise<void>) => scope.after(hook) : after)(() => put(original));
}

/** Runs `body` with `process.env[name]` set (or deleted when `value` is undefined), then restores it. */
export function withEnv<T>(name: string, value: string | undefined, body: () => T): T {
  const [original, put] = takeEnv(name);
  put(value);
  try {
    return body();
  } finally {
    put(original);
  }
}

/** Sets an environment variable for the rest of the file (or `scope`), restoring it at teardown. */
export function setEnv(name: string, value: string | undefined, scope?: RestoreScope): void {
  const [original, put] = takeEnv(name);
  put(value);
  restoreAt(original, put, scope);
}

/** Runs `body` with a `globalThis` property replaced, then restores it. */
export function withGlobal<T, V>(name: string, value: V, body: () => T): T {
  const [original, put] = takeGlobal(name);
  put(value);
  try {
    return body();
  } finally {
    put(original);
  }
}

/** Sets a `globalThis` property for the rest of the file (or `scope`), restoring it at teardown. */
export function setGlobal<V>(name: string, value: V, scope?: RestoreScope): void {
  const [original, put] = takeGlobal(name);
  put(value);
  restoreAt(original, put, scope);
}

/** Runs `body` from `dir`, returning to the previous working directory even when it throws. */
export function withWorkingDirectory<T>(dir: string, body: () => T): T {
  const original = process.cwd();
  process.chdir(dir);
  try {
    return body();
  } finally {
    process.chdir(original);
  }
}

/** Reads the exit code `body` leaves behind and restores the process's own. */
export function withExitCode<T>(body: () => T): { result: T; code: string | number | undefined } {
  const original = process.exitCode;
  process.exitCode = undefined;
  try {
    return { result: body(), code: process.exitCode };
  } finally {
    process.exitCode = original;
  }
}
