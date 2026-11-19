// The subscribe island reveals each copy button and writes the address. The result goes to the
// panel's live region, so assistive technology reads it, and both the button and the region return
// to their earlier text on the same schedule. A browser without a clipboard keeps the buttons hidden.
import assert from "node:assert/strict";
import { test } from "node:test";
import { activate, activateAll, copy, type Button, type Env } from "../components/add-to-calendar/client.ts";

interface FakeButton extends Button {
  clicks: Array<() => void>;
  click(): void;
}

function button(text: string): FakeButton {
  const clicks: Array<() => void> = [];
  return {
    hidden: true,
    textContent: text,
    dataset: { text: "https://example.com/books.ics" },
    clicks,
    addEventListener(_type, listener) {
      clicks.push(listener);
    },
    click() {
      for (const listener of clicks) listener();
    },
  };
}

function env(clipboard: Env["clipboard"]): { env: Env; runs: Array<() => void> } {
  const runs: Array<() => void> = [];
  return { env: { clipboard, schedule: (callback) => runs.push(callback) }, runs };
}

test("a missing clipboard leaves the copy buttons hidden", () => {
  const copyButton = button("Copy");
  const status = { textContent: "" };
  const root = { dataset: {}, querySelector: () => status, querySelectorAll: () => [copyButton] };
  activate(root, env(undefined).env);
  assert.equal(copyButton.hidden, true);
});

test("a copy writes the address, tells the live region, and resets", async () => {
  const written: string[] = [];
  const copyButton = button("Copy");
  const status = { textContent: "" };
  const root = {
    dataset: { copied: "Copied", copyFailed: "Press Ctrl+C" },
    querySelector: (selector: string) => (selector === ".list-subscribe-status" ? status : null),
    querySelectorAll: () => [copyButton],
  };
  const fake = env({ writeText: async (text: string) => void written.push(text) });
  activateAll({ querySelectorAll: () => [root] }, fake.env);

  assert.equal(copyButton.hidden, false);
  copyButton.click();
  await Promise.resolve();
  assert.deepEqual(written, ["https://example.com/books.ics"]);
  assert.equal(copyButton.textContent, "Copied");
  assert.equal(status.textContent, "Copied");

  for (const run of fake.runs) run();
  assert.equal(copyButton.textContent, "Copy");
  assert.equal(status.textContent, "");
});

test("a failed copy offers the manual fallback", async () => {
  const copyButton = button("Copy");
  const status = { textContent: "" };
  const root = {
    dataset: { copied: "Copied", copyFailed: "Press Ctrl+C" },
    querySelector: () => status,
    querySelectorAll: () => [copyButton],
  };
  await copy(copyButton, root, {
    clipboard: { writeText: async () => Promise.reject(new Error("denied")) },
    schedule: () => undefined,
  });
  assert.equal(status.textContent, "Press Ctrl+C");
});
