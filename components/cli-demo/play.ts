/* Line-by-line playback for a cli-demo session. It only shows and hides lines that are already in the page: nothing is fetched, run, or typed, and it never starts on its own. */

/** How long a line waits before the next one appears. */
export const LINE_MS = 700;

/** Where playback stands. `idle` shows every line; `done` is the same, after a full run. */
export type PlayState = "idle" | "playing" | "paused" | "done";

/** A line the player shows or hides. */
export interface PlayLine {
  hidden: boolean;
}

/** Timers and motion preference the player reads; tests pass fakes. */
export interface PlayEnv {
  schedule(callback: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
  /** True when the reader prefers reduced motion: playback is not offered and every line stays shown. */
  readonly reducedMotion: boolean;
}

export interface Player {
  readonly state: () => PlayState;
  /** Starts from the first line, or resumes after a pause. Does nothing when motion is reduced. */
  play(): void;
  pause(): void;
  /** Stops and shows every line. */
  showAll(): void;
}

/** Makes a player over `lines`; `onChange` runs after every change of state. */
export function createPlayer(lines: readonly PlayLine[], env: PlayEnv, onChange: (state: PlayState) => void = () => {}): Player {
  let state: PlayState = "idle";
  let shown = lines.length;
  let timer: unknown;

  const set = (next: PlayState): void => {
    state = next;
    onChange(next);
  };

  const stop = (): void => {
    if (timer !== undefined) env.cancel(timer);
    timer = undefined;
  };

  const step = (): void => {
    timer = undefined;
    const line = lines[shown];
    if (line !== undefined) line.hidden = false;
    shown += 1;
    if (shown >= lines.length) {
      set("done");
      return;
    }
    timer = env.schedule(step, LINE_MS);
  };

  return {
    state: () => state,
    play() {
      if (env.reducedMotion || lines.length === 0 || state === "playing") return;
      if (state !== "paused") {
        for (const line of lines) line.hidden = true;
        shown = 0;
      }
      set("playing");
      step();
    },
    pause() {
      if (state !== "playing") return;
      stop();
      set("paused");
    },
    showAll() {
      stop();
      for (const line of lines) line.hidden = false;
      shown = lines.length;
      set("idle");
    },
  };
}
