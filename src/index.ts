/**
 * What the engine needs to know about this theme: its name and the folders it discovers units in.
 * The sailcloth redesign also exports as `@velella/lateen/redesign` (see `redesign/src/index.ts`).
 * Home and 404 use the sailcloth shell chrome.
 */
export const theme = {
  name: "lateen",
  folders: ["layouts", "chrome", "components", "tokens", "styles"],
} as const;
