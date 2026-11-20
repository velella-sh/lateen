/// <reference lib="dom" />

export type SearchPage = { title: string; description: string; url: string };

export function searchPages(pages: readonly SearchPage[], query: string): SearchPage[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return pages
    .filter((page) => `${page.title} ${page.description}`.toLowerCase().includes(term))
    .sort((a, b) => Number(b.title.toLowerCase().includes(term)) - Number(a.title.toLowerCase().includes(term)))
    .slice(0, 8);
}

export function themeColor(theme: string): string {
  return theme === "dark" ? "#23212c" : "#f4f4f9";
}

export function readingProgress(scrollY: number, articleTop: number, articleHeight: number, viewport: number): number {
  const height = Math.max(articleHeight - viewport, 1);
  const ratio = (scrollY - (articleTop - 40)) / height;
  return Math.min(1, Math.max(0, ratio));
}

/** Reading positions live in sessionStorage, one entry per path. */
const POSITION_KEY = "lateen-scroll";
const SAVE_DELAY = 200;

export function positionKey(path: string): string {
  return `${POSITION_KEY}:${path}`;
}

/** The offset saved for a path, or null when the page has none. */
export function readPosition(storage: Storage | undefined, path: string): number | null {
  try {
    const y = Number(storage?.getItem(positionKey(path)));
    return Number.isFinite(y) && y > 0 ? y : null;
  } catch {
    return null; // storage refused (private mode)
  }
}

/** Remember one page's offset. Storage may refuse; the page still works. */
export function savePosition(storage: Storage | undefined, path: string, y: number): void {
  try {
    storage?.setItem(positionKey(path), String(Math.round(Math.max(0, y))));
  } catch {
    /* nothing remembered */
  }
}

/** A history traversal the browser rebuilt; bfcache pages keep their own position. */
export function historyNavigation(window: Window): boolean {
  const entries = typeof window.performance.getEntriesByType === "function" ? window.performance.getEntriesByType("navigation") : [];
  return (entries[0] as PerformanceNavigationTiming | undefined)?.type === "back_forward";
}

/** Put the reader back after a rebuilt page, once the browser has finished laying it out. */
export function restorePosition(window: Window, storage: Storage | undefined): void {
  const y = readPosition(storage, window.location.pathname);
  if (y === null) return;
  const jump = () => window.requestAnimationFrame(() => window.scrollTo(0, y));
  if (window.document.readyState === "complete") jump();
  else window.addEventListener("load", jump, { once: true });
}

export function boot(window: Window): void {
  // Progress and sticky glass only; search, theme, and drawer ship their own chrome clients.
  const { document } = window;
  const header = document.querySelector("[data-site-header]");
  if (!header) return;
  const headerClasses = header.classList;
  const progress = document.querySelector<HTMLElement>("[data-progress]");
  const article = document.querySelector<HTMLElement>("#main");
  let scheduled = false;

  function syncChrome(): void {
    const y = window.scrollY || 0;
    const ratio = article && progress ? readingProgress(y, article.offsetTop, article.scrollHeight, window.innerHeight) : 0;
    headerClasses.toggle("is-scrolled", y > 8);
    if (!progress || !article) return;
    progress.style.transform = `scaleX(${ratio.toFixed(4)})`;
    progress.classList.toggle("is-on", y > 20 && ratio > 0 && ratio < 1);
  }

  function scheduleChrome(): void {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      syncChrome();
    });
  }

  let storage: Storage | undefined;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = undefined; // storage refused (private mode)
  }
  const path = window.location.pathname;
  let saveTimer: number | undefined;

  function scheduleSave(): void {
    if (saveTimer !== undefined) return;
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      savePosition(storage, path, window.scrollY || 0);
    }, SAVE_DELAY);
  }

  syncChrome();
  window.addEventListener("scroll", scheduleChrome, { passive: true });
  window.addEventListener("resize", scheduleChrome);
  window.addEventListener("scroll", scheduleSave, { passive: true });
  window.addEventListener("pageshow", (event) => {
    // bfcache restored the page and its position already; reloads and link visits must not jump.
    if (event.persisted || !historyNavigation(window)) return;
    // shortcut: history forward also reports back_forward, so it may restore too; upgrade when browsers expose direction everywhere.
    restorePosition(window, storage);
  });
}

if (typeof window !== "undefined") boot(window);
