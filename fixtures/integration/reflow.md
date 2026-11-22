---
title: Reflow at 320
description: Tabs, code, a long link, and a wide table on one narrow article.
layout: doc
permalink: /reflow/
---

## Keep the page still

The page must fit an effective 320px width. A long address stays unbroken here:
https://example.com/releases/2026/11/20/widget-darwin-arm64-standalone-archive-without-any-spaces-reflow-2026-fix.tar.gz

:::tabs{group="reflow"}
### macOS

Install with Homebrew or unpack the archive.

### Linux

Install with the package manager or unpack the archive.

### Windows

Install with winget or unpack the archive.
:::

:::code-tabs{labels='["npm","A deliberately long package manager name"]'}
```bash
npm install @example/widget
```

```bash
pnpm add @example/widget
```
:::

```ts
export const release = "https://example.com/releases/2026/11/20/widget-darwin-arm64-standalone-archive-without-any-spaces-reflow-2026-fix.tar.gz";
```

## Nested list

1. Install the package.
   - Pick a distribution.
   - Read the [setup guide](/guide/install/) for `packageManager`.
2. Check the installation.

> The preview uses the same settings as the production build.

## Wide table

| Option | Type | Default | What it does |
| --- | :---: | --- | --- |
| `distributionArchive` | string | `https://example.com/releases/2026/11/20/widget-darwin-arm64-standalone-archive-without-any-spaces-reflow-2026-fix.tar.gz` | The archive the installer downloads and verifies before unpacking. |
| `packageManager` | string | `npm` | The package manager the install steps use. |
| `platform` | string | detected | The operating system the installer targets. |
| `integrity` | string | sha256:81c32b7aee61ea4f48af3901f1b231a93e0f16beb9800c05e8409825551de87b | The checksum the installer verifies. |
