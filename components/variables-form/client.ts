/*
 * Variables form island: copies what a reader types into the placeholders of the same variable in the
 * examples that belong to the form's group. A form, a terminal, and an output block are connected only by
 * a matching `data-variable-group`; a page with exactly one form that has no authored group keeps the
 * original page-wide behavior, so a single form still drives inline placeholders and ungrouped code
 * blocks. Inline code becomes `<span class="placeholder" data-var="name">` and a code block records its
 * variables in `data-placeholders`, both from the engine's placeholders plugin; the engine has no group
 * identity for inline code, so grouped inline and code-block annotation is not part of this island.
 *
 * The island validates each declared type before a value reaches an example: `url`, `number`, and
 * `boolean` follow the documented contract, `string` (and an unknown type) accepts any text. An invalid
 * input is marked `aria-invalid`, shows its server-rendered message, sets the form's invalid state, and
 * blocks the copy buttons of terminals in the same group; an output block in the group is stale while any
 * input is invalid. A recorded output is never rewritten, because nobody can run the command again here.
 * Freshness is remembered from the values each group was wired with, and reset puts those defaults back,
 * revalidates them, restores the examples, clears the stale state, and announces itself in a live region.
 * Other groups are untouched. Values stay in the browser: no cookie, no storage, no request, and no
 * command is ever executed.

 *
 * Module map: `contract.ts` holds the selectors and interfaces, `placeholders.ts` the substitution,
 * `freshness.ts` the stale-output state, and `view.ts` the validity, terminal, and announcement updates.
 * This entry keeps the form wiring and the browser bootstrap, and re-exports the public surface.
 */

import { GROUP_ATTRIBUTE, GROUP_EXPLICIT_ATTRIBUTE, TYPE_ATTRIBUTE } from "./group.ts";
import { isValidValue, validationTypeOf } from "./validation.ts";
import {
  FORM_SELECTOR,
  INPUT_SELECTOR,
  RESET_SELECTOR,
  type GroupScope,
  type PlaceholderNode,
  type PlaceholderRoot,
  type ResetButton,
  type VariableForm,
  type VariableInput,
} from "./contract.ts";
import { applyValue } from "./placeholders.ts";
import { recomputeStaleness, recordValue, stateOf, type GroupState } from "./freshness.ts";
import { announce, showValidity, syncTerminals } from "./view.ts";

export * from "./contract.ts";
export { appliesTo, applyValue, groupOf, namesOf, replaceIn, tokenOf } from "./placeholders.ts";
export {
  createGroupState,
  isBlocked,
  markStale,
  mergeStates,
  recomputeStaleness,
  recordValue,
  stalenessOf,
  type GroupState,
  type Staleness,
} from "./freshness.ts";

/** Reads a form's current values, keyed by variable name. */
export function valuesOf(form: VariableForm): Map<string, string> {
  const values = new Map<string, string>();
  for (const node of form.querySelectorAll(INPUT_SELECTOR)) {
    const input = node as VariableInput;
    const name = input.getAttribute("data-var");
    if (name !== null && name !== "") values.set(name, input.value);
  }
  return values;
}

/** Whether an input passes its declared type; a value the island rejects never reaches an example. */
export function isValid(input: VariableInput): boolean {
  const type = validationTypeOf(input.getAttribute(TYPE_ATTRIBUTE));
  if (type === "string") return input.validity?.valid !== false;
  return isValidValue(type, input.value);
}

/** One value a reset puts back: the input, its variable name, and the declared default. */
export interface ResetStep {
  readonly input: VariableInput;
  readonly name: string;
  readonly value: string;
}

/** The declared defaults a reset restores, in form order; the click handler only writes and revalidates them. */
export function defaultsOf(form: VariableForm): ResetStep[] {
  const steps: ResetStep[] = [];
  for (const node of form.querySelectorAll(INPUT_SELECTOR)) {
    const input = node as VariableInput;
    const name = input.getAttribute("data-var");
    if (name === null || name === "") continue;
    steps.push({ input, name, value: input.getAttribute("data-default") ?? "" });
  }
  return steps;
}

/** Validates one input, records the outcome, shows its message, and copies it only when it is accepted. */
function commitInput(
  root: PlaceholderRoot,
  form: VariableForm,
  scope: GroupScope,
  state: GroupState,
  input: VariableInput,
  name: string,
): boolean {
  const valid = isValid(input);
  recordValue(state, name, input.value, valid);
  showValidity(form, input, name, valid);
  if (valid) applyValue(root, name, input.value, scope);
  return valid;
}

/**
 * Wires one form: every input is validated and applies its default to the examples in the form's group, and
 * every change revalidates, updates the examples, blocks or unblocks the group's terminal copy buttons, and
 * recomputes whether the group's recorded outputs are stale. The reset button puts every declared default
 * back, revalidates them, clears the stale state, and announces itself; other groups are untouched. Returns
 * the names wired.
 */
export function activate(root: PlaceholderRoot, form: VariableForm): string[] {
  const group = form.getAttribute?.(GROUP_ATTRIBUTE) ?? "";
  const explicit = form.getAttribute?.(GROUP_EXPLICIT_ATTRIBUTE) === "true";
  const forms = [...root.querySelectorAll(FORM_SELECTOR)];
  const scope: GroupScope = { group, legacy: forms.length <= 1 && !explicit };
  const state = stateOf(root, group);
  const names: string[] = [];

  for (const node of form.querySelectorAll(INPUT_SELECTOR)) {
    const input = node as VariableInput;
    const name = input.getAttribute("data-var");
    if (name === null || name === "") continue;
    names.push(name);
    const baseline = input.getAttribute("data-default") ?? input.value;
    if (!state.baselines.has(name)) state.baselines.set(name, baseline);
    commitInput(root, form, scope, state, input, name);

    input.addEventListener("input", () => {
      commitInput(root, form, scope, state, input, name);
      syncTerminals(root, form, scope, state);
      recomputeStaleness(root, scope);
    });
  }

  syncTerminals(root, form, scope, state);
  recomputeStaleness(root, scope);

  const reset = form.querySelector?.(RESET_SELECTOR) as ResetButton | null | undefined;
  if (reset !== null && reset !== undefined) {
    reset.hidden = false;
    reset.addEventListener("click", () => {
      for (const step of defaultsOf(form)) {
        step.input.value = step.value;
        commitInput(root, form, scope, state, step.input, step.name);
      }
      syncTerminals(root, form, scope, state);
      recomputeStaleness(root, scope);
      announce(form);
    });
  }

  return names;
}

declare const document:
  | (PlaceholderRoot & { querySelectorAll(selector: string): Iterable<PlaceholderNode> })
  | undefined;

// The island runs when the browser loads it; importing it in a build or a test without a document does nothing.
if (typeof document !== "undefined") {
  for (const element of document.querySelectorAll(FORM_SELECTOR)) {
    activate(document, element as unknown as VariableForm);
  }
}
