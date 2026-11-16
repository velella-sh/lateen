# CLI demo

A terminal session and an install command are shown as fixed text. A reader can select and copy it, an
agent can read it, and neither needs a video, an image, or a script. This note fixes how a session is
written, what is copied, what an agent reads, and what the component never does. The tests use the
same format.

## The source format

A session is the body of a `:::cli-demo` directive, best written as one fenced block so Markdown keeps
every character. Each line starts with a mark or with nothing:

| Line starts with | Kind | Shown as | Copy commands | Copy all |
| --- | --- | --- | --- | --- |
| `$ ` | command | the prompt `$`, then the command | yes, without the prompt | yes, with the prompt |
| `# ` | comment | muted text, marked `#` | no | yes |
| `! ` | error | text with a visible `error` label | no | yes |
| anything else | output | plain text, labelled `output` for a screen reader | no | yes |

- The mark and one space after it are removed from the text of a command or an error. A comment keeps
  its `#`, since the mark is part of what the author wrote.
- A command keeps the lines a trailing backslash continues and the bodies of its heredocs; those lines
  are command input and are copied with the command. This is the same rule as the `terminal` component.
- A blank line is an output line and keeps its height.
- A mark inside a heredoc body or after a continuation belongs to the command, not to a new line.

The directive reads these attributes: `play` (reveals lines one by one on request) and `src` (a text
file in the site that holds the session instead of the body).

## What the copy buttons take

- **Copy commands** takes the command lines only, joined by newlines, without the prompt, comments,
  output, or errors. It is the button a reader pastes into a shell.
- **Copy all** takes the whole session as written: every line, with its prompt and marks.
- Without JavaScript there are no buttons. The block is plain, selectable text, and the prompt, the
  `error` label, and the `output` label are marked `user-select: none`, so a selection copies the
  text and not the decoration.

## What an agent reads

The rendered text carries the kind of every line in `data-line` (`command`, `output`, `error`,
`comment`) and the number of the command each line belongs to. Labels are text, so they survive
a text-only read. An inert `application/json` script lists each command with the prompt, the input,
and the output that followed it, the same record the `terminal` component publishes. Nothing in it
depends on a style, a colour, or a script.

## What the component never does

- It never records a session, and it adds no video or image format.
- It never runs, evaluates, or expands a line. A command is text.
- It never fetches anything. A `src` file is read at build time from inside the site folder, never from
  outside it and never over the network.
- It never starts playing on load. Playback happens only when the reader asks, and a reader who
  prefers reduced motion or has no script gets every line at once.

## Install tabs

`install-tabs` shows one install command for several package managers. The managers come from
`theme.options.installTabs.managers`, a list of `name` and `command` pairs; `{package}` in a command is
replaced by the `package` attribute. Without the option the component shows one generic manager,
`npm`, and ships no longer list. Every panel is in the HTML and a CSS rule switches panels
without JavaScript; the island adds the tab list and remembers the reader's choice, wrapping every
storage call so a blocked store changes nothing.
