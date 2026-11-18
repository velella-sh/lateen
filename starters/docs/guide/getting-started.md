---
title: Getting started
description: Install Sandbar and run your first task.
layout: doc
permalink: /guide/getting-started/
order: 1
---

Sandbar is an invented tool, so nothing here installs for real. The steps show how a guide reads once the sample text is yours.

## Install

:::code-tabs{labels='["npm","pnpm"]'}
```bash
npm install --save-dev sandbar
```

```bash
pnpm add --save-dev sandbar
```
:::

:::callout{type=note title="Requirements"}
Sandbar needs Node 24 or later. Run `node --version` to check.
:::

## Write a task file

Create `sandbar.yml` at the root of your project:

```yaml
tasks:
  build:
    run: npm run build
  test:
    run: npm test
    after: [build]
```

The project now looks like this:

:::file-tree{label="Project layout"}
- my-project/
  - **sandbar.yml** # the task file
  - package.json
  - src/
:::

## Run a task

```bash
npx sandbar run test
```

Sandbar runs `build` first, because `test` lists it under `after`, then runs `test`.

:::details{summary="What if a task fails?"}
Sandbar stops at the first failing task and exits with that task's exit code. Pass `--keep-going` to run the tasks that do not depend on it.
:::

## Next

Read the [command reference](../../reference/commands/) and the [configuration reference](../../reference/configuration/).
