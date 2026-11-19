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

function boot(): void {
  // Progress and sticky glass only; search, theme, and drawer ship their own chrome clients.
  if (!document.querySelector("[data-site-header]")) return;

  const header = document.querySelector("[data-site-header]");
  const progress = document.querySelector<HTMLElement>("[data-progress]");
  const article = document.querySelector<HTMLElement>("#main");

  function syncChrome(): void {
    const y = window.scrollY || 0;
    header?.classList.toggle("is-scrolled", y > 8);
    if (!article || !progress) return;
    const ratio = readingProgress(y, article.offsetTop, article.scrollHeight, window.innerHeight);
    progress.style.width = `${(ratio * 100).toFixed(2)}%`;
    progress.classList.toggle("is-on", y > 20 && ratio > 0 && ratio < 1);
  }

  syncChrome();
  window.addEventListener("scroll", syncChrome, { passive: true });
  window.addEventListener("resize", syncChrome);
}

if (typeof document !== "undefined") boot();
