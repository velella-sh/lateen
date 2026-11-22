import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { build, root } from "./integration-helpers.ts";

const languages = ["en", "fa", "ar"];

test("record facts and Mizzen field directives agree for each language and calendar", () => {
  const config = readFileSync(join(root, "fixtures", "data-site", "mizzen.yml"), "utf8");
  const template = `---
title: "Released {title}"
layout: record
record:
  facts:
    - { field: released, label: Released, kind: date }
---

Engine: :field[released]{format=long}
`;
  const files: Record<string, string> = {
    "_data/parity.json": JSON.stringify([{ id: "sample", title: "Sample", released: "2026-03-21" }]),
    "_templates/parity.md": template,
  };
  const collections = `  parity:
    source: _data/parity.json
    id: id
    template: _templates/parity.md
    permalink: /parity/{id}/
    dates: [released]
`;
  const locales = `languages:
  - { code: en, name: English, prefix: "" }
  - { code: fa, name: Persian, prefix: /fa }
  - { code: ar, name: Arabic, prefix: /ar }
`;

  for (const calendar of [undefined, "gregorian", "jalali"]) {
    const settings = calendar === undefined ? "" : `dates: { calendar: ${calendar} }\n`;
    const site = build("data-site", process.env, {
      ...files,
      "mizzen.yml": "search: false\n" + settings + locales + config.replace("collections:\n", `collections:\n${collections}`),
    });
    for (const lang of languages) {
      const prefix = lang === "en" ? "" : `/${lang}`;
      const doc = site.document(`${prefix}/parity/sample/`);
      assert.equal(doc.documentElement.lang, lang);
      const fact = doc.querySelector('#record-facts time[datetime="2026-03-21"]')?.textContent;
      const rendered = [...doc.querySelectorAll("p")].find((p) => p.textContent.startsWith("Engine: "))?.textContent;
      assert.ok(fact, `${lang}/${calendar ?? "default"} record date`);
      assert.equal(rendered, `Engine: ${fact}`, `${lang}/${calendar ?? "default"}`);
    }
  }
});
