#!/usr/bin/env bash
# Packs Lateen, installs it with the published Mizzen into an empty project, and builds the Lateen docs site with the
# installed `mizzen` command. It proves the published packages work from node_modules, not from a checkout.
# Usage: scripts/smoke-package.sh   (run from the repository root)
set -euo pipefail

lateen="$(pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir "$work/tar" "$work/project"
(cd "$lateen" && npm pack --silent --pack-destination "$work/tar" >/dev/null)

cd "$work/project"
npm init -y >/dev/null
npm install --silent --no-audit --no-fund "$work"/tar/velella-lateen-*.tgz preact

cp -R "$lateen/site" site
rm -rf site/.mizzen

# One site per shape: the docs site, the data fixture, and a starter the package ships. Each is
# content only: the theme comes from node_modules.
teamed=("site" "data-site")
cp -R "$lateen/fixtures/data-site" data-site
rm -rf data-site/.mizzen
for dir in "${teamed[@]}"; do
  node -e '
    const fs = require("node:fs");
    const file = process.argv[1] + "/mizzen.yml";
    const text = fs.readFileSync(file, "utf8");
    const theme = "theme:\n  name: \"@velella/lateen\"";
    fs.writeFileSync(file, /^theme:$/m.test(text) ? text.replace(/^theme:$/m, theme) : `${theme}\n${text}`);
  ' "$dir"
done

npx mizzen build site --out out
test -s out/index.html
grep -q 'class="mermaid-diagram"' out/components/mermaid/index.html

npx mizzen build data-site --out out-data
test -s out-data/index.html
test -s out-data/components/button/index.html

npx mizzen init starter --theme node_modules/@velella/lateen --starter docs
npx mizzen build starter --out out-starter
test -s out-starter/index.html

# A unit's file that the tarball leaves out fails here, not in a reader's build.
for path in layouts/doc.ts components/code/index.ts styles/src/ui.css i18n/en.json tokens/presets/harbor.json skills/lateen/SKILL.md starters/docs/starter.json visual/index.ts schema/options.schema.json; do
  test -s "node_modules/@velella/lateen/$path" || {
    echo "the package omits $path" >&2
    exit 1
  }
done

# The site tool (#505) is in the tarball and asks for its optional peer when Playwright is absent.
# Node does not strip types under node_modules; Mizzen registers the same hook for the theme's sources.
node --input-type=module -e '
  import { registerHooks, stripTypeScriptTypes } from "node:module";
  import { readFileSync } from "node:fs";
  import { fileURLToPath } from "node:url";
  registerHooks({
    load(url, context, nextLoad) {
      if (!url.endsWith(".ts")) return nextLoad(url, context);
      return { format: "module", shortCircuit: true, source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), "utf8"), { mode: "strip" }) };
    },
  });
  const { visualCheck } = await import("@velella/lateen/visual");
  if (typeof visualCheck !== "function") throw new Error("the visual export is missing");
  try {
    await visualCheck({ site: "out", pages: [{ name: "home", path: "/" }], baselines: "baselines" });
  } catch (error) {
    if (!/playwright/i.test(error.message) || !/npm i -D playwright/.test(error.message)) throw error;
    console.log("the visual export asks for Playwright, its optional peer");
    process.exit(0);
  }
  throw new Error("the visual export ran without Playwright");
'
echo "packages build the Lateen site and ship the visual export from node_modules"
