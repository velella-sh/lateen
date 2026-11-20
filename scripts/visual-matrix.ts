// The component state matrix: test/visual/states.json is the checked list of interaction cases,
// test/visual/inventory.json names every component of the theme. The JSON stays the source of
// truth; this derives the cases from it and reports a missing, unknown or duplicated component or
// state. The runner writes one shot per case as `<component>-<state>.png`.
//
// Usage: node scripts/visual-matrix.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { islandComponents, loadStates, type InteractionState, type StatesFile } from "./test-visual.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

export const INVENTORY_FILE = join(ROOT, "test/visual/inventory.json");

/** The subset of the inventory this check reads: one name per component the gallery covers. */
export interface InventoryFile {
  readonly version: number;
  readonly components: readonly { readonly name: string }[];
}

const STATES: readonly InteractionState[] = ["hover", "focus", "pressed", "disabled"];

/** Reads the component inventory; like the state list, it is plain JSON. */
export function loadInventory(file: string = INVENTORY_FILE): InventoryFile {
  const inventory = JSON.parse(readFileSync(file, "utf8")) as InventoryFile;
  if (inventory.version !== 1) throw new Error(`unsupported inventory version ${inventory.version}`);
  return inventory;
}

export interface StateCase {
  /** File name without the extension, as the runner writes it. */
  readonly case: string;
  readonly component: string;
  readonly state: InteractionState;
  readonly page: string;
}

/** One case per listed state, in the stable order of the state list. */
export function stateMatrixCases(states: StatesFile): StateCase[] {
  return states.components.flatMap((entry) =>
    entry.states.map((state) => ({ case: `${entry.name}-${state}`, component: entry.name, state, page: entry.page ?? "/gallery/" })),
  );
}

/** Every way the checked state matrix drifts from the theme's interactive components. */
export function stateMatrixErrors(states: StatesFile, inventory: InventoryFile, components: readonly string[] = islandComponents()): string[] {
  const errors: string[] = [];
  const known = new Set(inventory.components.map((entry) => entry.name));
  const listed = new Map<string, number>();
  for (const entry of states.components) {
    listed.set(entry.name, (listed.get(entry.name) ?? 0) + 1);
    if (!known.has(entry.name)) errors.push(`unknown component: ${entry.name}`);
    const seen = new Set<string>();
    for (const state of entry.states) {
      if (!STATES.includes(state)) errors.push(`${entry.name}: unknown state: ${state}`);
      if (seen.has(state)) errors.push(`${entry.name}: duplicate state: ${state}`);
      seen.add(state);
    }
  }
  for (const [name, count] of listed) if (count > 1) errors.push(`duplicate component: ${name}`);
  for (const name of components) if (!listed.has(name)) errors.push(`missing component: ${name}`);

  const counts = new Map<string, number>();
  for (const entry of stateMatrixCases(states)) counts.set(entry.case, (counts.get(entry.case) ?? 0) + 1);
  for (const [name, count] of counts) if (count > 1) errors.push(`duplicate case: ${name}`);
  return errors;
}

/** The checked matrix plus the derived cases; a non-empty list is a failure. */
export function checkVisualMatrix(): { readonly cases: StateCase[]; readonly errors: string[] } {
  const states = loadStates();
  return { cases: stateMatrixCases(states), errors: stateMatrixErrors(states, loadInventory()) };
}

function main(): void {
  const { cases, errors } = checkVisualMatrix();
  for (const entry of cases) console.log(`${entry.case}  ${entry.page}`);
  console.log(`${cases.length} state cases across ${new Set(cases.map((entry) => entry.component)).size} components`);
  for (const error of errors) console.error(`FAIL: ${error}`);
  if (errors.length > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
