---
title: CLI demo
description: A terminal session and install tabs in the accessibility matrix.
layout: doc
permalink: /cli-demo/
---

This page shows a terminal session and an install command.

## Terminal

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

## Install

:::install-tabs{package=example-package}
:::
