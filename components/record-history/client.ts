/* The record history island: the filter links work on their own, and this module only improves them. */
import { bootOnce } from "../../src/boot.ts";
import { activate, type HistoryDocument } from "./island.ts";

const globals = globalThis as unknown as { document?: HistoryDocument };

if (globals.document && bootOnce("components/record-history", globals.document)) {
  activate(globals.document);
}
