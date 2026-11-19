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

  syncChrome();
  window.addEventListener("scroll", scheduleChrome, { passive: true });
  window.addEventListener("resize", scheduleChrome);
}

if (typeof window !== "undefined") boot(window);
