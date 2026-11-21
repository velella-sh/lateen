/**
 * localStorage key that holds the visitor's choice: `light` or `dark`.
 * It lives in its own file so the toggle's island can import it without pulling in the layout and its server-only code.
 */
export const THEME_KEY = "lateen-theme";

export const THEME_CHOICES = ["light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export const DEFAULT_THEME: ThemeChoice = "dark";
