---
title: CLI demo
description: A terminal session and an install command as fixed, copyable text, with no video and no dependence on JavaScript.
layout: doc
permalink: /components/cli-demo/
---

A CLI demo shows a terminal session as text: commands with a prompt, output, errors, and comments. A reader copies only the commands, or the whole session. `install-tabs` shows one install command for several package managers. Neither records, runs, or fetches anything; both read without JavaScript.

## Syntax

Write the session as one fenced block inside the directive. Each line starts with a mark or with nothing:

| Line starts with | Kind | Copy commands | Copy all |
| --- | --- | --- | --- |
| `$ ` | command, shown with a prompt | yes, without the prompt | yes |
| `# ` | comment | no | yes |
| `! ` | error, shown with an `error` label | no | yes |
| anything else | output | no | yes |

````markdown
:::cli-demo
```sh
$ example install example-package
Resolving packages
# the next line fails on purpose
$ example run missing-task
! error: no task named "missing-task"
```
:::
````

A command keeps the lines a trailing backslash continues and the bodies of its heredocs. A mark inside them belongs to the command, not to a new line.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `play` | flag | off | Shows Play, Pause, and Show all buttons that reveal the lines one by one when the reader asks. It never starts by itself. |
| `src` | path | none | A text file in the site that holds the session instead of the body. A path that starts with `/` begins at the site folder; any other path begins at the page. A file outside the site folder is never read. |

## Example

:::cli-demo{play}
```sh
$ example install example-package
Resolving packages
Installed 1 package
# the next line fails on purpose
$ example run missing-task
! error: no task named "missing-task"
```
:::

From a file with `src`:

:::cli-demo{src="/components/cli-demo-session.txt"}
:::

## What the reader sees without JavaScript

The session is plain, selectable text. The prompt and the labels are not selected, so a selection copies the text and not the decoration. There are no buttons and nothing plays. A reader who prefers reduced motion gets every line at once with JavaScript on, too.

## For agents

Every row says what it is in `data-line` (`command`, `output`, `error`, or `comment`) and its text carries the labels, so no colour is needed. An inert JSON script lists one record per command with its `input`, `output` and `errors`.

## Install tabs

`install-tabs` shows one command per package manager. The managers come from the site option `theme.options.installTabs.managers`, a list of `name` and `command`; `{package}` in a command becomes the package name. Without the option the component shows one generic manager, `npm`.

```yaml
theme:
  options:
    installTabs:
      managers:
        - name: npm
          command: npm install {package}
        - name: pnpm
          command: pnpm add {package}
        - name: yarn
          command: yarn add {package}
```

```markdown
:::install-tabs{package=example-package}
:::
```

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `package` | string | first line of the body | The package name that replaces `{package}`. |
| `id` | string | `install-tabs` | The prefix of this group's element ids. Give each group on a page its own. |
| `theme.options.installTabs.managers` | list | one generic manager | The managers to offer, up to eight, each with a `name` and a `command`. Entries without both are skipped. |

:::install-tabs{package=example-package}
:::

Every panel is in the HTML and the tabs switch by CSS, so the choice works without JavaScript. With JavaScript, the choice is remembered on this site; a browser that blocks storage simply forgets it.
