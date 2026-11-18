---
title: تثبيت الودجة
description: صفحة دليل في مصفوفة إمكانية الوصول، بكل مكوّنات الدليل.
layout: guide
permalink: /ar/guide/install/
lang: ar
dir: rtl
tags: [التثبيت]
guide:
  from: 0.1
  to: 0.2
  time: ١٠ دقائق
  risk: done
---

صفحة دليل مع شريط الملخص فوق النص والدليل التالي في أسفل الصفحة.

## قبل البدء

تحتاج الودجة إلى Node 24 أو أحدث. أبقِ الناتج القديم حتى تنجح الفحوص.

:::steps
1. ثبّت الحزمة.
2. ابنِ الموقع.
3. اقرأ الناتج.
:::

:::before-after{removed="1" added="1"}
```bash
widget build --out old
```

```bash
widget build --out dist
```
:::

:::trap
أبقِ الناتج القديم بجانب الجديد حتى تنجح الفحوص.
:::

:::check-list
- `npm run build` — ينتهي البناء.
- `npm test` — تنجح الاختبارات.
:::
