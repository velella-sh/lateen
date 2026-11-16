import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import cliDemo from "../components/cli-demo/index.ts";
import { activateAll } from "../components/cli-demo/client.ts";
import { createPlayer, LINE_MS, type PlayEnv } from "../components/cli-demo/play.ts";

function clock(reducedMotion = false) {
  let next = 1;
  const pending = new Map<number, () => void>();
  const env: PlayEnv = {
    reducedMotion,
    schedule: (cb) => {
      pending.set(next, cb);
      return next++;
    },
    cancel: (h) => void pending.delete(h as number),
  };
  const tick = () => {
    const [id, cb] = [...pending][0] ?? [];
    if (id !== undefined) pending.delete(id);
    cb?.();
  };
  return { env, tick, pending };
}

const lines = () => [{ hidden: false }, { hidden: false }, { hidden: false }];
const hidden = (l: { hidden: boolean }[]) => l.map((x) => x.hidden);

test("play reveals lines one by one, then finishes with everything shown", () => {
  const c = clock();
  const l = lines();
  const states: string[] = [];
  const p = createPlayer(l, c.env, (s) => states.push(s));
  assert.equal(LINE_MS > 0, true);
  p.play();
  assert.deepEqual(hidden(l), [false, true, true]);
  c.tick();
  assert.deepEqual(hidden(l), [false, false, true]);
  c.tick();
  assert.deepEqual(hidden(l), [false, false, false]);
  assert.equal(p.state(), "done");
  assert.deepEqual(states, ["playing", "done"]);
});

test("pause stops the reveal and play resumes where it stopped", () => {
  const c = clock();
  const l = lines();
  const p = createPlayer(l, c.env);
  p.play();
  p.pause();
  assert.equal(p.state(), "paused");
  assert.equal(c.pending.size, 0);
  assert.deepEqual(hidden(l), [false, true, true]);
  p.play();
  assert.deepEqual(hidden(l), [false, false, true]);
  assert.equal(p.state(), "playing");
});

test("show all stops playback and shows every line", () => {
  const c = clock();
  const l = lines();
  const p = createPlayer(l, c.env);
  p.play();
  p.showAll();
  assert.deepEqual(hidden(l), [false, false, false]);
  assert.equal(p.state(), "idle");
  assert.equal(c.pending.size, 0);
});

test("with reduced motion, play does nothing and every line stays shown", () => {
  const c = clock(true);
  const l = lines();
  const p = createPlayer(l, c.env);
  p.play();
  assert.deepEqual(hidden(l), [false, false, false]);
  assert.equal(p.state(), "idle");
});

function page(reducedMotion: boolean, attrs: Record<string, string> = { play: "" }) {
  const input = { props: attrs, html: "<p>$ a\nb\n$ c\nd</p>", page: { lang: "en", source: { file: "a.md", line: 1 } }, site: {} } as unknown as ComponentProps;
  const dom = new JSDOM(`<body>${renderToString(cliDemo(input as never) as never)}</body>`);
  const c = clock(reducedMotion);
  activateAll(dom.window.document as never, { ...c.env, clipboard: undefined });
  return { doc: dom.window.document, c };
}

const q = (doc: Document, k: string) => doc.querySelector(`[data-cli-demo-${k}]`) as HTMLButtonElement;
const shown = (doc: Document) => [...doc.querySelectorAll(".cli-demo-line")].map((x) => !x.hasAttribute("hidden"));

test("page: nothing plays on load; the controls appear and every line is shown", () => {
  const { doc } = page(false);
  assert.deepEqual(shown(doc), [true, true, true, true]);
  assert.equal(q(doc, "play").hidden, false);
  assert.equal(q(doc, "pause").hidden, true);
  assert.equal(doc.querySelector(".cli-demo-bar")?.hasAttribute("hidden"), false);
});

test("page: play, pause and show all by their buttons", () => {
  const { doc, c } = page(false);
  q(doc, "play").click();
  assert.deepEqual(shown(doc), [true, false, false, false]);
  assert.equal(q(doc, "pause").hidden, false);
  assert.equal(q(doc, "play").hidden, true);
  c.tick();
  assert.deepEqual(shown(doc), [true, true, false, false]);
  q(doc, "pause").click();
  assert.equal(q(doc, "play").hidden, false);
  q(doc, "show-all").click();
  assert.deepEqual(shown(doc), [true, true, true, true]);
});

test("page: reduced motion keeps the controls and the bar hidden", () => {
  const { doc } = page(true);
  assert.equal(doc.querySelector(".cli-demo-bar")?.hasAttribute("hidden"), true);
  assert.deepEqual(shown(doc), [true, true, true, true]);
});

test("page: a session without play has no playback controls", () => {
  const { doc } = page(false, {});
  assert.equal(doc.querySelector("[data-cli-demo-play]"), null);
});
