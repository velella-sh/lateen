import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clickPopover,
  closePopover,
  escapePopover,
  fitToViewport,
  forgetPopover,
  openPopover,
  type OpenPopover,
  type PopoverBox,
  type PopoverRect,
} from "../src/popover.ts";

/** A panel with a rect and the CSS translate its stylesheet applies. */
class FakeBox implements PopoverBox {
  rect: PopoverRect;
  readonly style = { translate: "" };

  constructor(rect: PopoverRect) {
    this.rect = rect;
  }

  getBoundingClientRect(): PopoverRect {
    return this.rect;
  }
}

/** A panel the module can open; `inside` is the one click target that belongs to it. */
function panel(log: string[], inside: unknown, box: PopoverBox | undefined = undefined): OpenPopover {
  return {
    close: (focus) => log.push(`close:${focus}`),
    contains: (target) => target === inside,
    panel: box,
  };
}

/** No test leaves a panel open for the next one. */
function closeEverything(): void {
  clickPopover({});
}

test("Escape closes the open panel it is given and returns focus; other keys do nothing", () => {
  closeEverything();
  const log: string[] = [];
  const first = openPopover("symbol", panel(log, "first"));

  assert.equal(escapePopover({ key: "Tab" }, first), false);
  assert.equal(escapePopover({}, first), false);
  assert.deepEqual(log, [], "no other key closes it");

  assert.equal(escapePopover({ key: "Escape" }, first), true);
  assert.deepEqual(log, ["close:true"], "Escape asks for focus back");
  assert.equal(escapePopover({ key: "Escape" }, first), false, "a panel that is already closed stays closed");
  assert.deepEqual(log, ["close:true"], "a stale entry is not closed twice");

  assert.equal(escapePopover({ key: "Escape" }, undefined), false);
  assert.deepEqual(log, ["close:true"]);
});

test("opening a panel from another unit closes the open one without moving focus", () => {
  closeEverything();
  const log: string[] = [];
  openPopover("symbol", panel(log, "symbol"));
  openPopover("footnote", panel(log, "footnote"));

  assert.deepEqual(log, ["close:false"], "the symbol closes and its chip keeps focus");
});

test("panels of one unit stay open together unless the unit asks for one at a time", () => {
  closeEverything();
  const log: string[] = [];
  openPopover("symbol", panel(log, "first"));
  openPopover("symbol", panel(log, "second"));
  assert.deepEqual(log, [], "two disclosures may stay open together");

  const exclusiveLog: string[] = [];
  openPopover("term", panel(exclusiveLog, "one"), true);
  openPopover("term", panel(exclusiveLog, "two"), true);
  assert.deepEqual(exclusiveLog, ["close:false"], "a second exclusive panel closes the first");
});

test("a click closes every open panel but the one it landed in", () => {
  closeEverything();
  const log: string[] = [];
  openPopover("symbol", panel(log, "first"));
  openPopover("symbol", panel(log, "second"));

  clickPopover("second");
  assert.deepEqual(log, ["close:false"], "the other panel closes, focus stays on the click");

  clickPopover("second");
  assert.deepEqual(log, ["close:false"], "the clicked panel stays open");

  clickPopover("elsewhere");
  assert.deepEqual(log, ["close:false", "close:false"]);
});

test("forgetting a panel stops tracking it without closing it", () => {
  closeEverything();
  const log: string[] = [];
  const tracked = openPopover("symbol", panel(log, "tracked"));

  forgetPopover(tracked);
  clickPopover("elsewhere");
  assert.deepEqual(log, [], "an unregistered panel is not closed from outside");

  closePopover(tracked, true);
  assert.deepEqual(log, [], "a panel that is no longer open is not closed twice");
});

test("a panel past the inline edge is nudged back inside the viewport", () => {
  const box = new FakeBox({ left: 280, right: 300, top: 10, bottom: 30 });
  assert.deepEqual(fitToViewport(box, { width: 200, height: 100 }), { x: -108, y: 0 });
  assert.equal(box.style.translate, "-108px 0px");
});

test("a panel past the start edge or the bottom edge is nudged the other way", () => {
  const left = new FakeBox({ left: -20, right: 40, top: 10, bottom: 30 });
  assert.deepEqual(fitToViewport(left, { width: 200, height: 100 }), { x: 28, y: 0 });
  assert.equal(left.style.translate, "28px 0px");

  const bottom = new FakeBox({ left: 10, right: 50, top: 90, bottom: 120 });
  assert.deepEqual(fitToViewport(bottom, { width: 200, height: 100 }), { x: 0, y: -28 });
  assert.equal(bottom.style.translate, "0px -28px");
});

test("a panel that fits keeps no inline shift, and a later fit clears an older one", () => {
  const box = new FakeBox({ left: 280, right: 300, top: 10, bottom: 30 });
  fitToViewport(box, { width: 200, height: 100 });
  assert.equal(box.style.translate, "-108px 0px");

  box.rect = { left: 10, right: 50, top: 10, bottom: 30 };
  assert.deepEqual(fitToViewport(box, { width: 200, height: 100 }), { x: 0, y: 0 });
  assert.equal(box.style.translate, "", "the panel returns to its stylesheet position");
});

test("a panel with no measured box, or a runtime with no viewport, is left alone", () => {
  const zero = new FakeBox({ left: 0, right: 0, top: 0, bottom: 0 });
  assert.equal(fitToViewport(zero, { width: 200, height: 100 }), undefined);
  assert.equal(zero.style.translate, "");

  const box = new FakeBox({ left: 280, right: 300, top: 10, bottom: 30 });
  assert.equal(fitToViewport(box, undefined), undefined);
  assert.equal(box.style.translate, "");
});
