/**
 * Experimental redesign entry. Sailcloth chrome and tokens now live on the main
 * `@velella/lateen` theme; this export keeps the redesign site/demo path while
 * callers migrate off the dual theme name.
 */
export const theme = {
  name: "lateen-next",
  folders: ["layouts", "chrome", "components", "styles"],
} as const;
