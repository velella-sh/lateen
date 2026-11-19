/// <reference lib="dom" />

type ChartRow = { label: string; value: number };

async function draw(root: HTMLElement): Promise<void> {
  if (root.dataset.loaded === "true") return;
  root.dataset.loaded = "true";
  const canvas = root.querySelector("canvas");
  const data = root.querySelector("[data-chart-data]")?.textContent;
  if (!(canvas instanceof HTMLCanvasElement) || !data) return;
  const rows = JSON.parse(data) as ChartRow[];
  // @ts-expect-error The generated chart bundle has no TypeScript declarations.
  const { default: Chart } = await import("./chart.min.js");
  const context = canvas.getContext("2d");
  if (!context) return;
  const styles = getComputedStyle(root);
  new Chart(context, {
    type: "bar",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{
        data: rows.map((row) => row.value),
        backgroundColor: [styles.getPropertyValue("--chart-2"), styles.getPropertyValue("--chart-1"), styles.getPropertyValue("--chart-3")],
        borderRadius: 8,
        maxBarThickness: 56,
      }],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: styles.getPropertyValue("--muted-foreground") } },
        y: { beginAtZero: true, suggestedMax: 80, ticks: { color: styles.getPropertyValue("--muted-foreground"), callback: (value: number) => `${value} KB` }, grid: { color: styles.getPropertyValue("--border") } },
      },
    },
  });
  canvas.hidden = false;
}

const roots = document.querySelectorAll<HTMLElement>("[data-performance-chart]");
if (!("IntersectionObserver" in window)) roots.forEach((root) => void draw(root));
else {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      void draw(entry.target as HTMLElement);
    }
  }, { rootMargin: "300px" });
  roots.forEach((root) => observer.observe(root));
}

export {};
