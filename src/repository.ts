import type { RepositoryConfig } from "@velella/mizzen/contracts";

/*
 * Repository URL helpers shared by the chrome units that link to a site's repository (`edit-page`,
 * `report-issue`): host detection, source path handling, and the new-issue URL with its length limits.
 * A theme may `import type` from the engine's contracts and run none of its code, so the rules live here.
 */

/** The repository host an edit or issue URL is shaped for. */
export type Host = "github" | "gitlab";

/** Branch edit links point to when the config names none, the same default the engine uses. */
export const DEFAULT_BRANCH = "main";

/** The host's issue title limit; the title is cut to this many code points, ellipsis included. */
export const MAX_TITLE = 256;

/** Longest issue URL written; the engine caps at the same length. */
export const MAX_URL = 8000;

/** Marks a value that had to be cut to fit {@link MAX_URL}. */
export const ELLIPSIS = "…";

/** Collapses whitespace, so a title with newlines still reads as one line in the issue form. */
export function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** The repository's web URL without trailing slashes. */
export function webRoot(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * The host whose URL shape applies, from the repository's web URL: `github` for a host that names GitHub,
 * `gitlab` for gitlab.com and a self-hosted GitLab, and `undefined` for any other forge, which has no URL
 * this module can write without guessing. An unparseable URL also reads as `undefined`.
 */
export function hostOf(repository: RepositoryConfig): Host | undefined {
  let host: string;
  try {
    const parsed = new URL(repository.url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
    host = parsed.hostname.toLowerCase();
  } catch {
    return undefined;
  }
  if (host.includes("github")) return "github";
  if (host.includes("gitlab")) return "gitlab";
  return undefined;
}

/** A source path with forward slashes and no leading `./` or `/`, as the repository browser names it. */
export function sourcePath(file: string): string {
  return file
    .replace(/\\/g, "/")
    .replace(/^(?:\.\/)+/, "")
    .replace(/^\/+/, "");
}

/** Encodes each segment of a `/`-separated path, keeping the separators. */
export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** Cuts a title to {@link MAX_TITLE} code points, ellipsis included. */
export function clipTitle(title: string): string {
  const points = [...title];
  if (points.length <= MAX_TITLE) return title;
  return `${points.slice(0, MAX_TITLE - 1).join("")}${ELLIPSIS}`;
}

/** The host's new-issue URL for an already-built title and body; `extra` is extra query text starting with `&`. */
export function issueUrl(root: string, host: Host, title: string, body: string, extra = ""): string {
  const encodedTitle = encodeURIComponent(title.toWellFormed());
  const encodedBody = encodeURIComponent(body.toWellFormed());
  return host === "gitlab"
    ? `${root}/-/issues/new?issue[title]=${encodedTitle}&issue[description]=${encodedBody}${extra}`
    : `${root}/issues/new?title=${encodedTitle}&body=${encodedBody}${extra}`;
}

/** The URL, cut to {@link MAX_URL} by shortening the body, never inside a code point. */
export function fitUrl(root: string, host: Host, title: string, body: string, extra = ""): string | undefined {
  const full = issueUrl(root, host, title, body, extra);
  if (full.length <= MAX_URL) return full;

  const points = [...body];
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = issueUrl(root, host, title, `${points.slice(0, middle).join("")}${ELLIPSIS}`, extra);
    if (candidate.length <= MAX_URL) low = middle;
    else high = middle - 1;
  }
  const candidate = issueUrl(root, host, title, `${points.slice(0, low).join("")}${ELLIPSIS}`, extra);
  return candidate.length <= MAX_URL ? candidate : undefined;
}
