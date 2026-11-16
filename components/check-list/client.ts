/* check-list island: reveals the copy button of each command when the browser can copy. Without it the commands are plain text. */
import { wireDocument } from "../before-after/copy.ts";

export const BUTTON_SELECTOR = "[data-check-list-copy]";

wireDocument(BUTTON_SELECTOR);
