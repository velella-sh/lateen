/*
 * The command palette's payload, as the search dialog reads it: parse the inert JSON the server
 * writes into the dialog, keep only the actions this client knows how to run, and filter them on the
 * same query as the page results. Anything missing, malformed, or shaped differently yields an empty
 * palette, so a bad build cannot stop search from working.
 *
 * The module is pure: `client.ts` hands it the JSON text and the page language's fallback label, and
 * runs the descriptors that survive validation, so tests need no browser.
 */

import { parseJson } from "../../src/guards.ts";
import type { PaletteAction, PalettePayload, PaletteRun, ThemeChoice } from "../command-palette/actions.ts";
import { ACTIONS_LABEL } from "./options.ts";

/** A whole-word test for a hint, so a single typed letter does not match every hint. */
function containsWord(text: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(text);
}

/** Whether an action matches `query`; the pure counterpart of `chrome/command-palette/actions.ts`. */
export function matchesAction(action: PaletteAction, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  if (action.label.toLowerCase().includes(needle)) return true;
  return action.hint !== undefined && containsWord(action.hint, needle);
}

/** The actions that match `query`, in their original order. */
export function filterActions(actions: readonly PaletteAction[], query: string): readonly PaletteAction[] {
  return actions.filter((action) => matchesAction(action, query));
}

/** Whether `value` is one of the theme choices the palette can apply. */
function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

/** Whether `value` is an action descriptor this module knows how to run. */
export function isPaletteRun(value: unknown): value is PaletteRun {
  if (value === null || typeof value !== "object") return false;
  const run = value as { kind?: unknown; choice?: unknown; url?: unknown; id?: unknown };
  if (run.kind === "theme") return isThemeChoice(run.choice);
  if (run.kind === "copy") return typeof run.url === "string" && run.url !== "";
  if (run.kind === "source") return true;
  if (run.kind === "section") return typeof run.id === "string" && run.id !== "";
  return false;
}

/** Whether `value` is an action this module can show and run. */
function isPaletteAction(value: unknown): value is PaletteAction {
  if (value === null || typeof value !== "object") return false;
  const action = value as { id?: unknown; label?: unknown; hint?: unknown; run?: unknown };
  if (typeof action.id !== "string" || action.id === "") return false;
  if (typeof action.label !== "string" || action.label === "") return false;
  if (action.hint !== undefined && typeof action.hint !== "string") return false;
  return action.run === undefined || isPaletteRun(action.run);
}

/**
 * Reads the server's JSON. Anything missing, malformed, or shaped differently yields an empty
 * palette, so a bad build cannot stop search from working.
 */
export function parsePalette(text: string | null, fallbackLabel: string = ACTIONS_LABEL): PalettePayload {
  if (text === null || text.trim() === "") return { label: fallbackLabel, actions: [] };
  const value = parseJson(text);
  if (value === null || typeof value !== "object") return { label: fallbackLabel, actions: [] };
  const payload = value as { label?: unknown; actions?: unknown };
  const label = typeof payload.label === "string" && payload.label !== "" ? payload.label : fallbackLabel;
  const actions = Array.isArray(payload.actions) ? payload.actions.filter(isPaletteAction) : [];
  return { label, actions };
}