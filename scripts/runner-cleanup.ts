// Shared cleanup for the build runners (#884): servers, browsers and temporary outputs are
// released on success, failure and interruption (SIGINT/SIGTERM). Reports are written outside the
// temporary folders, so the evidence a failure needs survives the cleanup.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The signals a runner cleans up after, and the number the shell's 128 + n exit code uses. */
const SIGNALS = { SIGINT: 2, SIGTERM: 15 } as const;
type Signal = keyof typeof SIGNALS;

/**
 * Installs one-shot interrupt handlers that dispose and then exit with 128 + the signal number.
 * Returns the function that removes them again, so a finished run leaves the process as it was.
 */
function onInterrupt(dispose: () => void | Promise<void>): () => void {
  const installed: [Signal, () => void][] = [];
  for (const signal of Object.keys(SIGNALS) as Signal[]) {
    const handler = (): void => {
      void (async () => {
        try {
          await dispose();
        } catch (error) {
          console.error(`cleanup: ${(error as Error).message}`);
        } finally {
          process.exit(128 + SIGNALS[signal]);
        }
      })();
    };
    process.once(signal, handler);
    installed.push([signal, handler]);
  }
  return () => {
    for (const [signal, handler] of installed) process.removeListener(signal, handler);
  };
}

/** Runs every step, last registered first, collecting errors instead of stopping at the first. */
async function runSteps(steps: (() => void | Promise<void>)[]): Promise<unknown[]> {
  const errors: unknown[] = [];
  while (steps.length > 0) {
    const step = steps.pop() as () => void | Promise<void>;
    try {
      await step();
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

export interface CleanupScope {
  /** Registers a cleanup step; steps run last registered first, once, even when one throws. */
  add(step: () => void | Promise<void>): void;
  /** A temporary folder the cleanup removes; write reports elsewhere so they survive a failure. */
  tempDir(prefix: string): string;
}

/**
 * Runs `body` with a cleanup scope. The registered steps run when the body returns, when it
 * throws, and on SIGINT/SIGTERM (which then exits with 128 + the signal number). A cleanup error
 * never replaces the body's own error; it is logged beside it. With no body error, the first
 * cleanup error is thrown.
 */
export async function withCleanup<T>(body: (cleanup: CleanupScope) => Promise<T>): Promise<T> {
  const steps: (() => void | Promise<void>)[] = [];
  let ran = false;
  const dispose = async (): Promise<unknown[]> => {
    if (ran) return [];
    ran = true;
    return runSteps(steps);
  };
  const uninstall = onInterrupt(async () => {
    for (const error of await dispose()) console.error(`cleanup: ${(error as Error).message}`);
  });
  const scope: CleanupScope = {
    add: (step) => {
      steps.push(step);
    },
    tempDir: (prefix) => {
      const dir = mkdtempSync(join(tmpdir(), prefix));
      steps.push(() => rmSync(dir, { recursive: true, force: true }));
      return dir;
    },
  };
  let failed = false;
  try {
    return await body(scope);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    uninstall();
    const errors = await dispose();
    if (failed) {
      for (const error of errors) console.error(`cleanup: ${(error as Error).message}`);
    } else if (errors.length > 0) {
      throw errors[0];
    }
  }
}

/**
 * Runs a synchronous `body` with a temporary folder that is removed on success, failure and
 * interruption. The synchronous twin of `withCleanup` for runners that build with `spawnSync`.
 */
export function withTempOutput<T>(prefix: string, body: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const remove = (): void => rmSync(dir, { recursive: true, force: true });
  const uninstall = onInterrupt(remove);
  try {
    return body(dir);
  } finally {
    uninstall();
    remove();
  }
}