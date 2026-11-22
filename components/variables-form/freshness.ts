/* Output freshness: what each group remembers about its variables' recorded and current values, and the
 * decision whether a recorded output is stale, fresh, or unknown. A recorded output is never rewritten. */

import {
  OUTPUT_DEPENDENCY_SELECTOR,
  STALE_ATTRIBUTE,
  STALE_NOTE_SELECTOR,
  type GroupScope,
  type PlaceholderNode,
  type PlaceholderRoot,
} from "./contract.ts";
import { appliesTo, namesOf } from "./placeholders.ts";

/** Marks one recorded output stale and shows its note. The output text itself is never rewritten. */
function markBlock(block: PlaceholderNode): void {
  block.setAttribute?.(STALE_ATTRIBUTE, "true");
  const note = block.querySelector?.(STALE_NOTE_SELECTOR) ?? null;
  if (note !== null) note.textContent = block.getAttribute("data-stale-text") ?? "";
}

/** Clears one recorded output's stale marker and its note, because every value it was produced with is back. */
function clearBlock(block: PlaceholderNode): void {
  block.removeAttribute?.(STALE_ATTRIBUTE);
  const note = block.querySelector?.(STALE_NOTE_SELECTOR) ?? null;
  if (note !== null) note.textContent = "";
}

/**
 * Marks every recorded output that names `name` as out of date, and shows its note. The output text is never
 * rewritten: it is what a command printed once, and only re-running the command can change it. Returns how
 * many outputs were marked.
 */
export function markStale(root: PlaceholderRoot, name: string): number {
  let marked = 0;
  for (const block of root.querySelectorAll(OUTPUT_DEPENDENCY_SELECTOR)) {
    if (!namesOf(block.getAttribute("data-output-deps")).includes(name)) continue;
    markBlock(block);
    marked += 1;
  }
  return marked;
}

/** What one group remembers about its variables' recorded values, current values, and rejected inputs. */
export interface GroupState {
  /** Each variable's server-rendered default, i.e. the value the documented output was produced with. */
  readonly baselines: Map<string, string>;
  /** Each variable's last value a form applied, after validation. */
  readonly currents: Map<string, string>;
  /** Names whose current input the declared type rejects. */
  readonly invalid: Set<string>;
  /** Whether the group's terminals were blocked last time, so a live region is written only on a change. */
  blocked: boolean;
}

/** A group state with nothing recorded and nothing rejected. */
export function createGroupState(): GroupState {
  return { baselines: new Map(), currents: new Map(), invalid: new Set(), blocked: false };
}

/** Records one value and whether its declared type accepts it; the group's rejected names follow it. */
export function recordValue(state: GroupState, name: string, value: string, valid: boolean): void {
  state.currents.set(name, value);
  if (valid) state.invalid.delete(name);
  else state.invalid.add(name);
}

/** True while the group rejects a value, which blocks its terminals and marks its outputs stale. */
export function isBlocked(state: GroupState): boolean {
  return state.invalid.size > 0;
}

/** Several group states as one view: the earliest baseline, the latest current value, and any rejection. */
export function mergeStates(states: readonly GroupState[]): GroupState {
  const merged = createGroupState();
  for (const state of states) {
    for (const [name, value] of state.baselines) if (!merged.baselines.has(name)) merged.baselines.set(name, value);
    for (const [name, value] of state.currents) merged.currents.set(name, value);
    for (const name of state.invalid) merged.invalid.add(name);
  }
  return merged;
}

/** Whether a recorded output is older than its inputs, matches them, or cannot be checked for want of a baseline. */
export type Staleness = "stale" | "fresh" | "unknown";

/** The decision for one output's dependencies: any rejection or changed value is stale, a missing one is unknown. */
export function stalenessOf(state: GroupState, names: readonly string[]): Staleness {
  if (isBlocked(state)) return "stale";
  let unknown = false;
  for (const name of names) {
    const baseline = state.baselines.get(name);
    const current = state.currents.get(name);
    if (baseline === undefined || current === undefined) {
      unknown = true;
      continue;
    }
    if (baseline !== current) return "stale";
  }
  return unknown ? "unknown" : "fresh";
}

const freshness = new WeakMap<PlaceholderRoot, Map<string, GroupState>>();

/** The state for one form's group, created empty on first sight. */
export function stateOf(root: PlaceholderRoot, group: string): GroupState {
  const states = freshness.get(root) ?? new Map<string, GroupState>();
  freshness.set(root, states);
  const existing = states.get(group);
  if (existing !== undefined) return existing;
  const created = createGroupState();
  states.set(group, created);
  return created;
}

/** Every state on the page, for the legacy `recomputeStaleness(root)` call that predates groups. */
function statesOf(root: PlaceholderRoot): GroupState[] {
  const states = freshness.get(root);
  return states === undefined ? [] : [...states.values()];
}

/**
 * Re-derives every recorded output's stale state from the current values against the recorded ones. An
 * output is fresh, and its marker cleared, only when every one of its declared and inferred dependencies
 * has both a recorded value and a current one and they are equal; any dependency that differs, and any
 * input the group rejects, marks the output stale. With a scope only that group's outputs are touched; the
 * legacy call without one considers every group. A dependency no wired form has ever held gives no
 * trustworthy baseline, so such an output keeps the state it already has: the island never infers freshness
 * it cannot check. Outputs without dependencies are not touched.
 */
export function recomputeStaleness(root: PlaceholderRoot, scope?: GroupScope): void {
  const states = scope === undefined ? statesOf(root) : [stateOf(root, scope.group)];
  if (states.length === 0) return;
  const state = mergeStates(states);

  for (const block of root.querySelectorAll(OUTPUT_DEPENDENCY_SELECTOR)) {
    if (scope !== undefined && !appliesTo(block, scope)) continue;
    const names = namesOf(block.getAttribute("data-output-deps"));
    if (names.length === 0) continue;
    const staleness = stalenessOf(state, names);
    if (staleness === "stale") markBlock(block);
    else if (staleness === "fresh") clearBlock(block);
  }
}

