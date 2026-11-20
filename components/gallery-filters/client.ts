/* The gallery filters island: the links work on their own, and this module only improves them. */
import { bootOnce } from "../../src/boot.ts";
import { activate, type GalleryDocument } from "./island.ts";

const globals = globalThis as unknown as { document?: GalleryDocument };

if (globals.document && bootOnce("components/gallery-filters", globals.document)) {
  activate(globals.document);
}
