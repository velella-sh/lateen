#!/usr/bin/env bash
# Packs Lateen, installs it with the published Mizzen into an empty project, and builds the Lateen docs site with the
# installed `mizzen` command. It proves the published packages work from node_modules, not from a checkout.
# Usage: scripts/smoke-package.sh   (runs from any directory)
set -euo pipefail

# Resolve the checkout from this script, not the caller's working directory, so a space or a foreign
# cwd cannot change what gets packed. Every later command runs from an explicit directory.
lateen="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
test -f "$lateen/package.json" || { echo "not in the Lateen checkout: $lateen" >&2; exit 1; }
cd -- "$lateen"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# The exact installed engine, not the range in package.json: the consumer resolves the same Mizzen
# version the acceptance gate checks against.
mizzen="$(node -p "require(\"$lateen/node_modules/@velella/mizzen/package.json\").version")"

mkdir "$work/tar" "$work/project"
(cd "$lateen" && npm pack --silent --pack-destination "$work/tar" >/dev/null)

cd "$work/project"
npm init -y >/dev/null
npm install --silent --no-audit --no-fund "$work"/tar/velella-lateen-*.tgz preact "@velella/mizzen@$mizzen"

# An empty consumer type checks the package's exported paths by package name, with no import that
# reaches back into the checkout. `./visual` is loaded at runtime below because its Playwright types
# belong to an optional peer this consumer deliberately leaves out.
cat > consumer.ts <<'TS'
import { theme } from "@velella/lateen";
import { theme as redesign } from "@velella/lateen/redesign";

if (theme.name !== redesign.name) throw new Error("the redesign alias disagrees with the theme");
TS
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true
  },
  "include": ["consumer.ts"]
}
JSON
"$lateen/node_modules/.bin/tsc" -p tsconfig.json
echo "the consumer type checks @velella/lateen and @velella/lateen/redesign from the tarball"

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
# The compiled sailcloth CSS ships in the tarball: the consumer's base bundle carries the UI rules,
# not only the token and media sheets.
grep -qF ".chart-canvas" out/assets/theme/base-*.css

npx mizzen build data-site --out out-data
test -s out-data/index.html
test -s out-data/components/button/index.html

npx mizzen init starter --theme node_modules/@velella/lateen --starter docs
npx mizzen build starter --out out-starter
test -s out-starter/index.html

# Every source and generated artifact the installed theme needs, checked against the packed copy:
# a unit, island, font, schema, or redesign file the tarball leaves out fails here, not in a reader's build.
installed="$PWD/node_modules/@velella/lateen"
node "$lateen/scripts/check-package.ts" "$installed"

# The tarball carries the compiled sheet and the folder guides, and leaves out the build input: the
# Tailwind sources under styles/src (input for `npm run ui:css`, never read by the engine or a consumer),
# the per-unit READMEs, and the redesign tests.
test -s "$installed/styles/generated.css"
test -s "$installed/styles/tokens.css"
test -s "$installed/components/README.md"
test -s "$installed/chrome/README.md"
test ! -e "$installed/styles/src"
test ! -e "$installed/components/video/README.md"
test ! -e "$installed/chrome/language-switcher/README.md"
test ! -e "$installed/redesign/test"

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
  // Every exported package path loads from the installed tarball; `package.json` is data, not a module.
  const paths = Object.keys(JSON.parse(readFileSync("node_modules/@velella/lateen/package.json", "utf8")).exports);
  for (const path of paths) {
    if (path === "./package.json") continue;
    const spec = path === "." ? "@velella/lateen" : `@velella/lateen/${path.slice(2)}`;
    const mod = await import(spec);
    if (Object.keys(mod).length === 0) throw new Error(`${spec} exports nothing`);
    console.log(`${spec} loads from the tarball`);
  }
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
echo "packages build the Lateen site, type check every export and ship the visual export from node_modules"
