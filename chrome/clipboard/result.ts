/*
 * The one clipboard result path the clipboard islands share: write, learn whether it worked, show
 * that answer, and put the control's resting state back a moment later. `code-copy`,
 * `copy-markdown`, and `ask-agent` each keep their own localized words and their
 * own place to show them; this module owns only the order of events they all repeat — a failed
 * write is never reported as a success, a slower earlier write never overwrites a newer result,
 * and a pending restore can always be cancelled.
 *
 * The module is pure: islands pass their own clipboard and timers, tests pass fakes.
 */

/** The part of `navigator.clipboard` every clipboard island uses. */
export interface Clipboard {
  writeText(text: string): Promise<void>;
}

/** The timers the restore runs on; `cancel` is optional, so a hand-run test clock can omit it. */
export interface Timers {
  schedule(callback: () => void, ms: number): unknown;
  cancel?(handle: unknown): void;
}

/**
 * Writes `text` and resolves whether it worked. No clipboard, a refused write, a write that throws
 * in hand: `false`. Never rejects, so a caller has one success path and one failure path and
 * cannot mix them up.
 */
export async function writeClipboard(clipboard: Clipboard | undefined, text: string): Promise<boolean> {
  if (clipboard === undefined) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** How one control takes a result and gives its resting state back. */
export interface ResultFlash<T> {
  /**
   * Shows the result on `target`: `apply(target, ok)` runs at once, and after `resetMs` the
   * resting state returns — unless a newer `show` or `restore` for this target has superseded it.
   */
  show(target: T, ok: boolean): void;
  /** Cancels the pending restore and puts the resting state back at once. */
  restore(target: T): void;
}

/**
 * The shared result flash for one kind of control. `apply` writes the island's own success or
 * failure presentation (its localized words, its check icon, its `aria-busy`); `reset` puts the
 * resting state back. State is kept per target in a `WeakMap`, so controls the page drops are
 * forgotten and the flash itself never grows.
 */
export function createResultFlash<T extends object>(options: {
  timers: Timers;
  /** How long the result stays before the resting state returns. */
  resetMs: number;
  /** Presents the result: the island's own words and marks, keyed on whether the copy worked. */
  apply(target: T, ok: boolean): void;
  /** Puts the resting state back once the reset time has passed. */
  reset(target: T): void;
}): ResultFlash<T> {
  const pending = new WeakMap<T, { run: number; timer: unknown }>();

  return {
    show(target, ok) {
      const state = pending.get(target);
      const run = (state?.run ?? 0) + 1;
      // A result that is already on screen cannot be superseded by its own restore, so the timer
      // from the run it belongs to goes first.
      if (state !== undefined) options.timers.cancel?.(state.timer);
      const timer = options.timers.schedule(() => {
        if (pending.get(target)?.run !== run) return;
        pending.delete(target);
        options.reset(target);
      }, options.resetMs);
      pending.set(target, { run, timer });
      options.apply(target, ok);
    },
    restore(target) {
      const state = pending.get(target);
      if (state !== undefined) {
        options.timers.cancel?.(state.timer);
        pending.delete(target);
      }
      options.reset(target);
    },
  };
}
