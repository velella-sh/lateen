/* The variables form's view updates: an input's validity message, the group's terminal copy buttons, and
 * the reset announcement. They write to nodes the page rendered and hold no state of their own. */

import { ERROR_ATTRIBUTE, INVALID_ATTRIBUTE, INVALID_TEXT_ATTRIBUTE, RESET_TEXT_ATTRIBUTE } from "./group.ts";
import {
  ERROR_SELECTOR,
  STATUS_SELECTOR,
  TERMINAL_BUTTON_SELECTOR,
  TERMINAL_STATUS_SELECTOR,
  type GroupScope,
  type PlaceholderRoot,
  type VariableForm,
  type VariableInput,
} from "./contract.ts";
import { isBlocked, type GroupState } from "./freshness.ts";
import { appliesTo } from "./placeholders.ts";

/** Shows or hides the server-rendered message for one variable and sets its input's invalid state. */
export function showValidity(form: VariableForm, input: VariableInput, name: string, valid: boolean): void {
  if (valid) input.removeAttribute?.("aria-invalid");
  else input.setAttribute?.("aria-invalid", "true");
  for (const node of form.querySelectorAll(ERROR_SELECTOR)) {
    if (node === null || typeof node !== "object") continue;
    const error = node as { getAttribute(name: string): string | null; hidden?: boolean };
    if (error.getAttribute(ERROR_ATTRIBUTE) !== name) continue;
    error.hidden = valid;
  }
}

/** A copy button the island can disable while its group is invalid. */
interface CopyButton {
  disabled?: boolean;
}

/**
 * Applies the group's invalid state to its terminals: their copy buttons are disabled and their live region
 * says why, or both are cleared. Writes only when the state changes, so typing does not re-announce the same
 * sentence. The output block keeps its copy button: its text is the author's, not derived from the inputs.
 */
export function syncTerminals(root: PlaceholderRoot, form: VariableForm, scope: GroupScope, state: GroupState): void {
  const blocked = isBlocked(state);
  if (blocked) form.setAttribute?.(INVALID_ATTRIBUTE, "true");
  else form.removeAttribute?.(INVALID_ATTRIBUTE);
  if (state.blocked === blocked) return;
  state.blocked = blocked;
  for (const node of root.querySelectorAll(TERMINAL_BUTTON_SELECTOR)) {
    if (!appliesTo(node, scope)) continue;
    (node as unknown as CopyButton).disabled = blocked;
  }
  for (const node of root.querySelectorAll(TERMINAL_STATUS_SELECTOR)) {
    if (!appliesTo(node, scope)) continue;
    node.textContent = blocked ? node.getAttribute(INVALID_TEXT_ATTRIBUTE) ?? "" : "";
  }
}

/** Announces the reset in the form's live region. */
export function announce(form: VariableForm): void {
  const status = form.querySelector?.(STATUS_SELECTOR) as { textContent: string | null } | null | undefined;
  if (status === null || status === undefined) return;
  status.textContent = form.getAttribute?.(RESET_TEXT_ATTRIBUTE) ?? "";
}
