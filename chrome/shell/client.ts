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

function paintTheme(theme: "light" | "dark", animate: boolean): void {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (animate && !reduceMotion) {
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), 280);
  }
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  try { localStorage.setItem("lateen-theme", theme); } catch { /* optional */ }
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.append(meta);
  }
  meta.setAttribute("content", themeColor(theme));
  const toggle = document.querySelector<HTMLButtonElement>("[data-shell-theme-toggle]");
  if (!toggle) return;
  const dark = theme === "dark";
  toggle.setAttribute("aria-pressed", dark ? "true" : "false");
  toggle.setAttribute("aria-label", dark ? "Switch to light" : "Switch to dark");
}

function boot(): void {
  // Only enhance pages that render the sailcloth shell; other chrome owns theme elsewhere.
  if (!document.querySelector("[data-site-header]")) return;

  const root = document.documentElement;
  let saved: string | null = null;
  try { saved = localStorage.getItem("lateen-theme"); } catch { /* optional */ }
  const initial = saved === "light" || saved === "dark"
    ? saved
    : root.dataset.theme === "dark"
      ? "dark"
      : "light";
  paintTheme(initial, false);

  document.querySelector<HTMLButtonElement>("[data-shell-theme-toggle]")?.addEventListener("click", () => {
    paintTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
  });

  const dialog = document.querySelector<HTMLDialogElement>("[data-search-dialog]");
  const searchButton = document.querySelector<HTMLButtonElement>("[data-search-open]");
  const input = document.querySelector<HTMLInputElement>("[data-search-input]");
  const results = document.querySelector<HTMLElement>("[data-search-results]");
  const pagesText = document.querySelector("[data-search-pages]")?.textContent ?? "[]";
  const pages = JSON.parse(pagesText) as SearchPage[];
  let activeIndex = 0;

  function hitLinks(): HTMLAnchorElement[] {
    return results ? [...results.querySelectorAll("a")] : [];
  }

  function setActive(index: number): void {
    const links = hitLinks();
    if (!links.length) return;
    activeIndex = (index + links.length) % links.length;
    links.forEach((link, i) => link.toggleAttribute("data-active", i === activeIndex));
    links[activeIndex]?.scrollIntoView({ block: "nearest" });
  }

  function renderHits(query: string): void {
    if (!results) return;
    results.replaceChildren();
    const matches = searchPages(pages, query);
    if (!query.trim()) {
      const list = document.createElement("ul");
      list.className = "search-hits";
      for (const page of pages.slice(0, 8)) {
        const item = document.createElement("li");
        const anchor = document.createElement("a");
        anchor.href = page.url;
        anchor.innerHTML = `<strong>${page.title}</strong><span>${page.description}</span>`;
        item.append(anchor);
        list.append(item);
      }
      results.append(list);
      activeIndex = 0;
      setActive(0);
      return;
    }
    if (matches.length === 0) {
      const note = document.createElement("p");
      note.className = "empty";
      note.textContent = "No pages match.";
      results.append(note);
      return;
    }
    const list = document.createElement("ul");
    list.className = "search-hits";
    for (const page of matches) {
      const item = document.createElement("li");
      const anchor = document.createElement("a");
      anchor.href = page.url;
      anchor.innerHTML = `<strong>${page.title}</strong><span>${page.description}</span>`;
      item.append(anchor);
      list.append(item);
    }
    results.append(list);
    activeIndex = 0;
    setActive(0);
  }

  function closeSearch(): void { dialog?.close(); }
  function openSearch(): void {
    if (!dialog) return;
    renderHits("");
    if (!dialog.open) dialog.showModal();
    if (input) {
      input.value = "";
      input.focus();
    }
  }

  searchButton?.addEventListener("click", openSearch);
  dialog?.addEventListener("click", (event) => { if (event.target === dialog) closeSearch(); });
  input?.addEventListener("input", () => renderHits(input.value));
  input?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === "Enter") {
      const link = hitLinks()[activeIndex];
      if (!link) return;
      event.preventDefault();
      closeSearch();
      window.location.href = link.href;
    }
  });
  results?.addEventListener("mousemove", (event) => {
    const link = (event.target as HTMLElement).closest("a");
    if (!link || !results.contains(link)) return;
    const index = hitLinks().indexOf(link as HTMLAnchorElement);
    if (index >= 0) setActive(index);
  });
  results?.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("a")) closeSearch();
  });

  document.addEventListener("keydown", (event) => {
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLowerCase() === "k") {
      event.preventDefault();
      dialog?.open ? closeSearch() : openSearch();
      return;
    }
    const typing =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement;
    if (event.key === "/" && !dialog?.open && !typing) {
      event.preventDefault();
      openSearch();
    }
    if (event.key === "Escape" && dialog?.open) {
      event.preventDefault();
      closeSearch();
    }
  });

  for (const pre of document.querySelectorAll<HTMLElement>("pre.code-block")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn code-copy";
    button.dataset.variant = "secondary";
    button.dataset.size = "sm";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy code");
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pre.querySelector("code")?.textContent ?? "");
        button.textContent = "Copied";
        setTimeout(() => { button.textContent = "Copy"; }, 1600);
      } catch {
        button.textContent = "Copy failed";
      }
    });
    pre.append(button);
  }

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
