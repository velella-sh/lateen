/// <reference lib="dom" />

function reveal(root: HTMLElement): void {
  const button = root.querySelector<HTMLButtonElement>("[data-terminal-copy]");
  if (!button) return;
  button.hidden = false;
  button.addEventListener("click", async () => {
    const text = button.dataset.text ?? "";
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = "Copy";
      }, 1500);
    } catch {
      button.textContent = "Copy failed";
    }
  });
}

document.querySelectorAll<HTMLElement>("[data-terminal]").forEach(reveal);

export {};
