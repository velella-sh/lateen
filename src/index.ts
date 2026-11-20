/**
 * Lateen theme entry. Sailcloth design stack only:
 * Mizzen + Node + TypeScript + Preact + Tailwind + Lucide + Chart.js.
 */
export { isRecord, knownOf, knownOr, parseJson, textOf } from "./guards.ts";

export const theme = {
  name: "lateen",
  folders: ["layouts", "chrome", "components", "tokens", "styles"],
} as const;
