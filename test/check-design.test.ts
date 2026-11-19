import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { allowlistProblems, applyAllowlist, check, cssFiles, root, scanCss, type Kind } from "../scripts/check-design.ts";

const kinds = (css: string): Kind[] => scanCss("x.css", css).map((f) => f.kind);

test("each kind of raw value is found", () => {
  assert.deepEqual(kinds(".a { color: #fff; }"), ["colour"]);
  assert.deepEqual(kinds(".a { background: rgb(0 0 0 / 0.5); }"), ["colour"]);
  assert.deepEqual(kinds(".a { border-color: oklch(60% 0.1 200); }"), ["colour"]);
  assert.deepEqual(kinds(".a { font-size: 14px; }"), ["font-size"]);
  assert.deepEqual(kinds(".a { font-size: clamp(1rem, 2vw, 2rem); }"), ["font-size", "font-size", "font-size"]);
  assert.deepEqual(kinds(".a { box-shadow: 0 1px 2px black; }"), ["shadow"]);
  assert.deepEqual(kinds(".a { filter: drop-shadow(0 1px 2px black); }"), ["shadow"]);
  assert.deepEqual(kinds(".a { transition: opacity 150ms ease; }"), ["transition"]);
  assert.deepEqual(kinds(".a { animation-duration: 0.3s; }"), ["transition"]);
  assert.deepEqual(kinds(".a { z-index: 999; }"), ["z-index"]);
});

test("token references and local stacking are not findings", () => {
  const css = `.a { color: var(--color-text, #fff); font-size: var(--type-size-sm);
    box-shadow: var(--shadow-md); box-shadow: none; transition: opacity var(--motion-fast) var(--motion-ease);
    transition-duration: 0s; z-index: var(--layer-header); z-index: 1; z-index: -1; z-index: auto;
    background: color-mix(in srgb, var(--color-accent) 8%, var(--color-canvas)); }`;
  assert.deepEqual(scanCss("x.css", css), []);
});

test("comments and strings are ignored; line numbers are right", () => {
  const css = `/* color: #fff; */\n.a { content: "#fff; z-index: 9"; }\n.b {\n  z-index: 7;\n}`;
  const found = scanCss("x.css", css);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.line, 4);
});

test("the allowlist covers exact matches and flags stale entries", () => {
  const findings = scanCss("a.css", ".a { z-index: 7; }");
  const entry = { file: "a.css", kind: "z-index" as Kind, value: "7", reason: "local" };
  assert.deepEqual(applyAllowlist(findings, [entry]), { violations: [], stale: [] });
  assert.equal(applyAllowlist(findings, []).violations.length, 1);
  assert.equal(applyAllowlist(findings, [{ ...entry, value: "8" }]).stale.length, 1);
});

test("an entry without a reason is rejected", () => {
  assert.match(allowlistProblems([{ file: "a.css", kind: "colour", value: "#fff" }]).join(), /no written reason/);
  assert.match(allowlistProblems([{ file: "a.css", kind: "colour", value: "#fff", reason: "  " }]).join(), /no written reason/);
  assert.match(allowlistProblems([{ file: "a.css", kind: "bogus", value: "x", reason: "r" }]).join(), /unknown kind/);
  assert.deepEqual(allowlistProblems([]), []);
});

test("main passes with the committed allowlist", () => {
  assert.deepEqual(check(root), []);
});
