# Recipe: annotate code lines

A fenced block can name its lines and carry notes. The engine parses the fence metadata; the theme
renders a title bar, highlighted and numbered lines, diff marks, and a notes disclosure. No
JavaScript runs for any of it. The component page is [Code](../site/components/code.md).

## 1. Write the fence

```ts title="answer.ts" {3} showLineNumbers annotations={2: The exported constant | 3-4: A range of two lines}
export const answer = 42;
const doubled = answer * 2;
const tripled = answer * 3;
```

The full meta list is `title="…"`, `{lines}`, `showLineNumbers`, `ins={lines}`, `del={lines}`,
`diff`, and `annotations={line: text | from-to: text}`. Escape a literal `|` in a note as `\|`.

## 2. Build the docs site

Run from the theme checkout:

```bash
out=$(mktemp -d)
node_modules/.bin/mizzen build site --theme . --out "$out"
```

## 3. Check the proof

```bash
grep -o 'class="code-title"' "$out/components/code/index.html" | head -1
grep -o 'class="code-annotations"' "$out/components/code/index.html" | head -1
grep -o 'id="[^"]*-line-2"' "$out/components/code/index.html" | head -1
grep -o 'annotations={2: The exported constant' "$out/components/code/index.md"
```

The first three lines prove the title bar, the disclosure, and the line id the notes link to exist in
the built HTML. The last proves the Markdown twin keeps the fence meta verbatim for a reader or an
agent that starts from the source.
