import { readFile, writeFile } from "node:fs/promises";
import { collectDoctorRun } from "@velella/mizzen/reports";

const path = "site/_data/report-set.json";
const report = JSON.parse(await readFile(path, "utf8"));
report.runs.push(await collectDoctorRun(
  { root: "site", themeRoot: "node_modules/@velella/lateen" },
  { id: "installed-run", scope: "Acceptance site", date: "2026-11-23" },
));
await writeFile(path, JSON.stringify(report));
