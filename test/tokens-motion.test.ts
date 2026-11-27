import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadTokens, paths } from "../scripts/tokens.ts";

const ms = (value: string | undefined): number => {
  const match = /^([\d.]+)ms$/.exec(value ?? "");
  assert.ok(match, `${value} is not a millisecond duration`);
  return Number(match[1]);
};

const DURATIONS = ["fast", "base", "slow", "press", "menu-enter", "menu-exit", "dialog-enter", "dialog-exit", "theme-switch"];

test("every motion duration is under 400 ms, except the slow step that is exactly 400 (#1293)", () => {
  const tokens = loadTokens();
  for (const name of DURATIONS) {
    const value = ms(tokens.get(`motion-${name}`)?.light);
    assert.ok(name === "slow" ? value <= 400 : value < 400, `motion-${name} is ${value}ms`);
  }
});

test("every motion duration is zero under reduced motion (#1293)", () => {
  const tokens = loadTokens();
  for (const name of DURATIONS) assert.equal(ms(tokens.get(`motion-${name}`)?.reduced), 0, `motion-${name}`);
  const css = readFileSync(paths.css, "utf8");
  const block = css.slice(css.indexOf("prefers-reduced-motion"));
  for (const name of DURATIONS) assert.match(block, new RegExp(`--motion-${name}: 0ms;`), `reduced block lacks ${name}`);
});

test("menus, dialogs and the theme switch have enter and exit easings (#1293)", () => {
  const tokens = loadTokens();
  assert.equal(tokens.get("motion-ease-enter")?.light, "{motion.ease-out}");
  assert.equal(tokens.get("motion-ease-exit")?.light, "{motion.ease-in}");
  assert.match(readFileSync(paths.css, "utf8"), /--motion-ease-enter: var\(--motion-ease-out\);/);
});
