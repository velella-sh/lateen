---
title: عرض الطرفية
description: جلسة طرفية وتبويبات تثبيت في مصفوفة إمكانية الوصول.
layout: doc
permalink: /ar/cli-demo/
lang: ar
dir: rtl
---

تعرض هذه الصفحة جلسة طرفية وأمر تثبيت بالاتجاه من اليمين إلى اليسار.

## الطرفية

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

## التثبيت

:::install-tabs{package=example-package}
:::
