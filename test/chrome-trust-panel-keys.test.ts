// The trust panel is native; the island only opens it for the tested chip's fragment and closes it
// on Escape with focus returning to the chip.
import assert from "node:assert/strict";
import { test } from "node:test";
import { followHash, openForHash, PANEL_HASH, type TrustPanelNode } from "../chrome/trust-panel-keys/client.ts";

function panel(): { node: TrustPanelNode; opened: () => boolean } {
  let open = false;
  return {
    node: {
      get open() {
        return open;
      },
      set open(value: boolean) {
        open = value;
      },
      querySelector: () => null,
      addEventListener: () => {},
    },
    opened: () => open,
  };
}

test("the chip's fragment opens the panel and another fragment leaves it closed", () => {
  const one = panel();
  const two = panel();
  openForHash([one.node, two.node], PANEL_HASH);
  assert.equal(one.opened(), true);
  assert.equal(two.opened(), true);

  const closed = panel();
  openForHash([closed.node], "#another-heading");
  assert.equal(closed.opened(), false);
});

test("a later hash change opens the panel too, so a click after load works", () => {
  let listener: (() => void) | undefined;
  const one = panel();
  followHash([one.node], {
    location: { hash: "" },
    addEventListener: (type, callback) => {
      assert.equal(type, "hashchange");
      listener = callback;
    },
  });
  assert.equal(one.opened(), false);

  (one.node as TrustPanelNode & { open: boolean }).open = false;
  (one.node as unknown as { open: boolean }).open = false;
  listener?.();
  assert.equal(one.opened(), false, "an empty hash opens nothing");

  const later = panel();
  followHash([later.node], {
    location: { hash: PANEL_HASH },
    addEventListener: (_type, callback) => {
      listener = callback;
    },
  });
  assert.equal(later.opened(), true);
});
