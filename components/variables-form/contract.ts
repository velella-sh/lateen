/* The variables form island's contract: the selectors it finds, the stale attribute it writes, and the
 * narrow input, form, node, and scope interfaces it touches. Constants and types only. */

/** Attribute on the form root; the island finds forms by it. */
export const FORM_SELECTOR = "[data-variables-form]";

/** An input inside a form, keyed by the variable name. */
export const INPUT_SELECTOR = "input[data-var]";

/** The form's reset button, which restores every declared default. */
export const RESET_SELECTOR = "[data-variables-reset]";

/** An inline placeholder the engine wrote into a code span. */
export const INLINE_SELECTOR = ".placeholder[data-var]";

/** A code block whose variables the engine recorded in `data-placeholders`. */
export const BLOCK_SELECTOR = "[data-placeholders]";

/** A recorded output that named the variables it was produced with in `data-output-deps`. */
export const OUTPUT_DEPENDENCY_SELECTOR = "[data-output-deps]";

/** The note inside a recorded output that the island fills in when the output goes stale. */
export const STALE_NOTE_SELECTOR = "[data-output-stale-note]";

/** An input's visible error message. */
export const ERROR_SELECTOR = "[data-error-for]";

/** The form's live region, which announces a reset. */
export const STATUS_SELECTOR = "[data-variables-status]";

/** A terminal copy button whose group can be blocked while a value is invalid. */
export const TERMINAL_BUTTON_SELECTOR = "[data-terminal-copy]";

/** The live region beside a terminal copy button. */
export const TERMINAL_STATUS_SELECTOR = "[data-terminal-status]";

/** The part of an input the island reads and wires. */
export interface VariableInput {
  value: string;
  /** The browser's constraint validation; an absent one is treated as valid, so a fake needs only the rest. */
  readonly validity?: { readonly valid: boolean };
  getAttribute(name: string): string | null;
  setAttribute?(name: string, value: string): void;
  removeAttribute?(name: string): void;
  addEventListener(type: "input", listener: () => void): void;
}

/** The reset button: the island reveals it and restores the declared defaults on click. */
export interface ResetButton {
  hidden: boolean;
  addEventListener(type: "click", listener: () => void): void;
}

/** A form as the island touches it. The node methods are optional so a small fake needs only what it uses. */
export interface VariableForm {
  getAttribute?(name: string): string | null;
  setAttribute?(name: string, value: string): void;
  removeAttribute?(name: string): void;
  querySelectorAll(selector: string): Iterable<unknown>;
  querySelector?(selector: string): unknown;
}

/** A node the island rewrites: an element, a text node, or the document. */
export interface PlaceholderNode {
  readonly nodeType: number;
  textContent: string | null;
  readonly childNodes?: Iterable<PlaceholderNode> | undefined;
  getAttribute(name: string): string | null;
  setAttribute?(name: string, value: string): void;
  /** Removes the stale marker when the recorded output is fresh again; an absent one is treated as read-only. */
  removeAttribute?(name: string): void;
  querySelector?(selector: string): PlaceholderNode | null;
}

/** Everything the island reads from the page. Tests pass fakes; the browser supplies its own. */
export interface PlaceholderRoot {
  querySelectorAll(selector: string): Iterable<PlaceholderNode>;
}

/** The group a form drives, and whether the page is in the single-form legacy mode. */
export interface GroupScope {
  /** The form's group; empty only for a fake or a form that predates the attribute. */
  readonly group: string;
  /** True for the one-form page with no authored group: ungrouped examples still follow it. */
  readonly legacy: boolean;
}

/** The attribute that marks a recorded output as older than its inputs. */
export const STALE_ATTRIBUTE = "data-output-stale";
