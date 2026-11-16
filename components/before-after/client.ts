/* before-after island: reveals the copy button of each block when the browser can copy. Without it the code is plain text. */
import { wireDocument } from "./copy.ts";

export const BUTTON_SELECTOR = "[data-before-after-copy]";

wireDocument(BUTTON_SELECTOR);
