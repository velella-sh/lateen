/*
 * The network block of `theme.options`, validated. A site without a network keeps the defaults below;
 * an unknown value stops the build with a message that names the option, so a typo never silently
 * changes what the network chrome shows.
 */

/** The two places the project switcher can appear. */
export const SWITCHER_POSITIONS = ["header", "footer"] as const;

/** A place the project switcher can appear. */
export type SwitcherPosition = (typeof SWITCHER_POSITIONS)[number];

/** What the network chrome reads from `theme.options.network`. */
export interface NetworkOptions {
  /** Whether the project switcher renders. */
  readonly switcher: boolean;
  /** Whether the network footer renders. */
  readonly footer: boolean;
  /** Where the project switcher renders. */
  readonly position: SwitcherPosition;
}

/** The options a site gets when it sets no `theme.options.network`. */
export const DEFAULT_NETWORK_OPTIONS: NetworkOptions = {
  switcher: true,
  footer: true,
  position: "header",
};

/** True for a plain object, never an array or `null`. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The value at a dotted path under `theme.options`, or `undefined` when the path is absent or does
 * not lead through objects. Every path this returns is listed in `schema/options.schema.json`;
 * `test/options-schema.test.ts` fails when a unit names one the schema does not.
 */
export function optionOf(options: unknown, path: string): unknown {
  let value = options;
  for (const key of path.split(".")) {
    if (!isRecord(value)) return undefined;
    value = value[key];
  }
  return value;
}

/** An option value the theme cannot use, named by its path in `mizzen.yml`. */
function reject(option: string, expected: string, value: unknown): never {
  throw new Error(`${option} ${expected}; got ${JSON.stringify(value)}.`);
}

/** One on/off option: absent keeps `fallback`, anything but a boolean is rejected. */
function flag(value: unknown, option: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") reject(option, "must be true or false", value);
  return value;
}

/**
 * Reads `theme.options.network`: `switcher` and `footer` each turn one part off, and `position` moves
 * the switcher to the header (the default) or the footer. A missing block, or a missing member, keeps
 * its default; an unknown value throws with the `theme.options.network.<key>` path in the message.
 */
export function resolveNetworkOptions(options: unknown): NetworkOptions {
  if (!isRecord(options)) return DEFAULT_NETWORK_OPTIONS;
  const network = options.network;
  if (network === undefined) return DEFAULT_NETWORK_OPTIONS;
  if (!isRecord(network)) reject("theme.options.network", "must be an object", network);

  const position = network.position;
  if (position !== undefined && !SWITCHER_POSITIONS.includes(position as SwitcherPosition)) {
    reject("theme.options.network.position", 'must be "header" or "footer"', position);
  }

  return {
    switcher: flag(network.switcher, "theme.options.network.switcher", DEFAULT_NETWORK_OPTIONS.switcher),
    footer: flag(network.footer, "theme.options.network.footer", DEFAULT_NETWORK_OPTIONS.footer),
    position: (position ?? DEFAULT_NETWORK_OPTIONS.position) as SwitcherPosition,
  };
}

/** Every option path the page documents, so the documentation test and the reader see one list. */
export const NETWORK_OPTION_PATHS = [
  "theme.options.network.switcher",
  "theme.options.network.footer",
  "theme.options.network.position",
] as const;
