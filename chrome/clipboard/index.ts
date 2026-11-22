import type { Chrome } from "@velella/mizzen/contracts";

/**
 * Renders nothing: this unit owns only the clipboard write → result → restore sequence the
 * clipboard chrome shares (`result.ts`). The controls that show those results belong to
 * `code-copy`, `copy-markdown`, and `ask-agent`, which keep their own words,
 * their own status region, and their own island.
 */
const clipboardResult: Chrome = () => null;

export default clipboardResult;

export {
  createResultFlash,
  writeClipboard,
  type Clipboard,
  type ResultFlash,
  type Timers,
} from "./result.ts";
