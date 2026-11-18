# Math in Markdown

Inline math is `$…$`; a block opens and closes on a line that holds only `$$`.

```markdown
The area is $a^2$.
```

```markdown
$$
\frac{a}{b} = c
$$
```

- `\$` is a literal dollar, so `\$5` stays text.
- A `$` inside a code span or a fenced block is text, never math.
- Math is not parsed for Markdown: `*` and `_` inside `$…$` are TeX.

A broken formula keeps its TeX at its source position and the page still builds: `math.syntax`
for an unbalanced command, `math.unsupported` for a command outside the subset, and
`math.unclosed-block` for a `$$` line with no partner. The output is MathML in the page, with the
TeX in `alttext` and an `<annotation encoding="application/x-tex">`; nothing is downloaded at runtime.

The Markdown twin keeps the original `$…$` and `$$` block unchanged, so an agent reads the same
formula the author wrote.
