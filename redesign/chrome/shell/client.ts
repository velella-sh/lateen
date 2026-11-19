/// <reference lib="dom" />

export type SearchPage = { title: string; description: string; url: string };

export function searchPages(pages: readonly SearchPage[], query: string): SearchPage[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return pages
    .filter((page) => `${page.title} ${page.description}`.toLowerCase().includes(term))
    .sort((a, b) => Number(b.title.toLowerCase().includes(term)) - Number(a.title.toLowerCase().includes(term)))
    .slice(0, 6);
}

function boot(): void {
  const root = document.documentElement;
  const themeButton = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if (themeButton) {
    themeButton.hidden = false;
    themeButton.addEventListener("click", () => {
      const theme = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = theme;
      root.classList.toggle("dark", theme === "dark");
      try { localStorage.setItem("lateen-theme", theme); } catch { /* Storage is optional. */ }
    });
  }

  const dialog = document.querySelector<HTMLDialogElement>("[data-search-dialog]");
  const searchButton = document.querySelector<HTMLButtonElement>("[data-search-open]");
  const input = document.querySelector<HTMLInputElement>("[data-search-input]");
  const results = document.querySelector<HTMLElement>("[data-search-results]");
  const pagesText = document.querySelector("[data-search-pages]")?.textContent ?? "[]";
  const pages = JSON.parse(pagesText) as SearchPage[];

  function closeSearch(): void { dialog?.close(); }
  function openSearch(): void {
    if (!dialog) return;
    dialog.showModal();
    input?.focus();
  }

  searchButton?.addEventListener("click", openSearch);
  if (searchButton) searchButton.hidden = false;
  document.querySelector("[data-search-close]")?.addEventListener("click", closeSearch);
  dialog?.addEventListener("click", (event) => { if (event.target === dialog) closeSearch(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialog?.open) {
      event.preventDefault();
      closeSearch();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
  });
  input?.addEventListener("input", () => {
    if (!results) return;
    results.replaceChildren();
    const matches = searchPages(pages, input.value);
    if (matches.length === 0) {
      const note = document.createElement("p");
      note.textContent = input.value.trim() ? "No matching pages." : "Type to search six pages.";
      results.append(note);
      return;
    }
    const list = document.createElement("ul");
    for (const page of matches) {
      const item = document.createElement("li");
      const anchor = document.createElement("a");
      const title = document.createElement("strong");
      const description = document.createElement("span");
      anchor.href = page.url;
      title.textContent = page.title;
      description.textContent = page.description;
      anchor.append(title, description);
      item.append(anchor);
      list.append(item);
    }
    results.append(list);
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
}

if (typeof document !== "undefined") boot();
