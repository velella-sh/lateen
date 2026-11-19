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
  const { default: Chart } = await import("../performance-chart/chart.min.js");
  const context = canvas.getContext("2d");
  if (!context) return;
  const styles = getComputedStyle(root);
  const type = root.dataset.chartType === "line" ? "line" : "bar";
  const colors = [
    styles.getPropertyValue("--chart-1").trim() || "#4c6f9a",
    styles.getPropertyValue("--chart-2").trim() || "#8f8cd8",
    styles.getPropertyValue("--chart-3").trim() || "#8fb0d4",
  ];
  new Chart(context, {
    type,
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{
        data: rows.map((row) => row.value),
        backgroundColor: type === "bar" ? rows.map((_, index) => colors[index % colors.length]) : colors[1],
        borderColor: colors[0],
        borderRadius: 6,
        maxBarThickness: 28,
        tension: 0.35,
        fill: false,
      }],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: styles.getPropertyValue("--muted-foreground") },
        },
        y: {
          beginAtZero: true,
          ticks: { color: styles.getPropertyValue("--muted-foreground") },
          grid: { color: styles.getPropertyValue("--border") },
        },
      },
    },
  });
  canvas.hidden = false;
  root.querySelector(".charts-fallback")?.setAttribute("hidden", "");
}

const roots = document.querySelectorAll<HTMLElement>("[data-charts]");
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
