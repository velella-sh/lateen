---
title: نمایش ترمینال
description: نشست ترمینال و زبانه‌های نصب در ماتریس دسترس‌پذیری.
layout: doc
permalink: /fa/cli-demo/
lang: fa
dir: rtl
---

این صفحه یک نشست ترمینال و یک دستور نصب را در جهت راست‌به‌چپ نشان می‌دهد.

## ترمینال

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

## نصب

:::install-tabs{package=example-package}
:::
