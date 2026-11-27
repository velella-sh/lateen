/* The figure zoom island: popover panels already open and close without it; this keeps one panel of a multi-image figure open at a time. */
import { bootOnce } from "../../src/boot.ts";
import { activate, type ZoomDocument } from "./island.ts";

const globals = globalThis as unknown as { document?: ZoomDocument };

if (globals.document && bootOnce("components/figure", globals.document)) {
  activate(globals.document);
}
